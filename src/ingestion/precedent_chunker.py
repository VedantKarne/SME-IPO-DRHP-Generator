import os
import json
import logging
import re
from collections import defaultdict
from typing import List, Dict, Any, Optional, Sequence, Tuple
from pydantic import BaseModel

from src.retrieval.parent_doc_store import ParentDocStore
from src.ingestion.context_enricher import enrich_chunk_text
from src.config.precedent_registry import ChapterIndex

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Parent blocks are what hybrid_retriever substitutes for a child hit before the
# text reaches the drafting prompt, so they must stay prompt-sized. These mirror
# the regulatory chunker so both corpora behave the same way.
PARENT_MAX_WORDS = 1200
CHILD_MAX_WORDS = 350
CHILD_OVERLAP_WORDS = 50

class PrecedentChunk(BaseModel):
    chunk_id: str
    parent_id: str
    source_doc: str
    text: str
    enriched_text: str
    metadata: Dict[str, Any]

class PrecedentChunker:
    """
    Chunks a filed DRHP into parent/child blocks with real chapter attribution.

    Previously this produced 500-word windows whose only metadata came from
    splitting the PDF filename on underscores, and whose "parent" context was
    `chunk_text[:100] + "..."` — i.e. an expansion that made the retrieved text
    *shorter*. Since hybrid_retriever substitutes the parent for the child hit,
    every precedent passage reaching the drafting prompt was ~100 characters.
    """

    def __init__(self, db_path: str = "Databases/parent_doc_store.db"):
        self.parent_store = ParentDocStore(db_path=db_path)

    # ------------------------------------------------------------------ helpers

    def _classify_industry(self, text_sample: str) -> str:
        """
        Classify the issuer's industry via Groq. Returns "" when unavailable —
        an empty value is honest, whereas defaulting to "Other" asserts a
        classification that was never made.
        """
        industries = ["Manufacturing", "SaaS", "Healthcare", "FMCG",
                      "Financial Services", "Infrastructure", "Other"]
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return ""
        try:
            from groq import Groq
            client = Groq(api_key=api_key)
            completion = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": (
                    "You are a financial analyst. Classify the primary industry of the "
                    "company described in this DRHP excerpt.\n"
                    f"Choose exactly one from: {', '.join(industries)}\n\n"
                    f"Text:\n{text_sample[:3000]}\n\nRespond with ONLY the industry name."
                )}],
                temperature=0.0,
                max_tokens=10,
            )
            result = (completion.choices[0].message.content or "").strip()
            for industry in industries:
                if industry.lower() in result.lower():
                    return industry
        except Exception as e:
            logger.warning(f"Industry classification failed: {e}")
        return ""

    @staticmethod
    def _split_words(text: str, max_words: int, overlap: int) -> List[Tuple[int, str]]:
        """Split into blocks, returning (starting word offset, block text)."""
        words = text.split()
        if len(words) <= max_words:
            return [(0, text)]
        step = max(1, max_words - overlap)
        blocks: List[Tuple[int, str]] = []
        for start in range(0, len(words), step):
            block = words[start:start + max_words]
            if not block:
                break
            blocks.append((start, " ".join(block)))
            if start + max_words >= len(words):
                break
        return blocks

    @staticmethod
    def _build_page_map(pages: Sequence[Tuple[int, str]]) -> Tuple[str, List[Tuple[int, int]]]:
        """
        Join page texts and record where each page starts in the word stream, so
        a chunk's word offset can be resolved back to the page it came from.
        Returns (full_text, [(cumulative_word_offset, pdf_page), ...]).
        """
        parts: List[str] = []
        offsets: List[Tuple[int, int]] = []
        total = 0
        for page_no, text in pages:
            text = text or ""
            offsets.append((total, page_no))
            parts.append(text)
            total += len(text.split())
        return "\n".join(parts), offsets

    @staticmethod
    def _page_for_offset(offsets: Sequence[Tuple[int, int]], word_offset: int) -> int:
        page = offsets[0][1] if offsets else 0
        for start, page_no in offsets:
            if start <= word_offset:
                page = page_no
            else:
                break
        return page

    # ----------------------------------------------------------------- chunking

    def process_pages(
        self,
        pages: Sequence[Tuple[int, str]],
        source_doc_id: str,
        company: str = "",
        year: str = "",
        industry: str = "",
        chapter_index: Optional[ChapterIndex] = None,
    ) -> List[PrecedentChunk]:
        """
        Chunk a parsed filing.

        `pages` is [(pdf_page_number, page_text), ...] in document order — page
        numbers are required so each chunk can be attributed to the chapter that
        covers it, via the filing's own table of contents.
        """
        full_text, offsets = self._build_page_map(pages)
        if not full_text.strip():
            logger.warning(f"No text to chunk for {source_doc_id}")
            return []

        if not industry:
            industry = self._classify_industry(full_text[:3000])

        doc_slug = re.sub(r"[^A-Za-z0-9]+", "_", os.path.splitext(source_doc_id)[0]).strip("_")
        chunks: List[PrecedentChunk] = []
        attributed = 0

        for parent_offset, parent_text in self._split_words(full_text, PARENT_MAX_WORDS, 0):
            parent_id = f"{doc_slug}_p{parent_offset}"

            for child_offset, child_text in self._split_words(
                parent_text, CHILD_MAX_WORDS, CHILD_OVERLAP_WORDS
            ):
                absolute_offset = parent_offset + child_offset
                chunk_id = f"{parent_id}_c{child_offset}"
                page = self._page_for_offset(offsets, absolute_offset)

                section, section_group = ("", "")
                if chapter_index:
                    section, section_group = chapter_index.chapter_for_page(page)
                if section:
                    attributed += 1

                # Store the real parent block. This is what gets substituted for
                # the child at retrieval time, so it must be the wider context.
                self.parent_store.store(
                    child_id=chunk_id,
                    child_text=child_text,
                    parent_id=parent_id,
                    parent_text=parent_text,
                )

                metadata = {
                    "company": company,
                    "year": year,
                    "industry": industry,
                    "section": section,
                    "section_group": section_group,
                    "page": page,
                }

                chunks.append(PrecedentChunk(
                    chunk_id=chunk_id,
                    parent_id=parent_id,
                    source_doc=source_doc_id,
                    text=child_text,
                    enriched_text=enrich_chunk_text(child_text, metadata),
                    metadata=metadata,
                ))

        logger.info(
            f"{source_doc_id}: {len(chunks)} chunks, "
            f"{attributed} chapter-attributed "
            f"({len({c.metadata.get('section') for c in chunks if c.metadata.get('section')})} distinct chapters)"
        )
        return chunks


def save_precedent_chunks(chunks: List[PrecedentChunk], output_dir: str):
    """Write one JSONL per source document. Previously all documents were written
    to a single file named after chunks[0].source_doc, which made 20 filings look
    like 1."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    if not chunks:
        return

    by_doc: Dict[str, List[PrecedentChunk]] = defaultdict(list)
    for chunk in chunks:
        by_doc[chunk.source_doc].append(chunk)

    for source_doc, doc_chunks in by_doc.items():
        output_path = os.path.join(output_dir, f"{source_doc}_chunks.jsonl")
        with open(output_path, 'w', encoding='utf-8') as f:
            for chunk in doc_chunks:
                f.write(chunk.model_dump_json() + '\n')
        logger.info(f"Wrote {len(doc_chunks)} precedent chunks to {output_path}")
