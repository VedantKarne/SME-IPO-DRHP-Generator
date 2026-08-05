import os
import re
import json
import logging
from collections import defaultdict
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from src.retrieval.parent_doc_store import ParentDocStore
from src.ingestion.context_enricher import enrich_chunk_text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# A parent block is what gets injected into the drafting prompt when a child hit is
# expanded (hybrid_retriever replaces the child text with it), so it must stay
# prompt-sized. Oversized units (schedules run to ~36k words) are split into
# several parent blocks rather than stored whole.
PARENT_MAX_WORDS = 1200
CHILD_MAX_WORDS = 350
CHILD_OVERLAP_WORDS = 50

APPLICABILITY_SME = "SME"
APPLICABILITY_UNSPECIFIED = "UNSPECIFIED"

# ICDR Chapter IX is the SME chapter. Text markers catch SME provisions that live
# elsewhere (e.g. schedules that carve out SME issuers).
_SME_CHAPTERS = {"IX"}
_SME_TEXT_RE = re.compile(
    r"small\s+and\s+medium\s+enterprises?|\bSME\s+(?:exchange|platform|issuer)", re.IGNORECASE
)


class RegulatoryChunk(BaseModel):
    clause_id: str
    parent_id: str
    source_doc: str
    chapter: str
    chapter_title: str = ""
    regulation_number: str
    regulation_title: str = ""
    disclosure_category: str
    applicability: str
    text: str
    enriched_text: str
    effective_date: Optional[str] = None
    superseded_by: Optional[str] = None


class RegulatoryChunker:
    def __init__(self, db_path: str = "Databases/parent_doc_store.db"):
        self.parent_store = ParentDocStore(db_path=db_path)

        # Headings are matched per line against the full document text. `CHAPTER` and
        # `SCHEDULE` are required to be upper-case: the regulations also refer to
        # "Chapter IX (Initial Public Offer by...)" mid-sentence, which is a
        # cross-reference, not a boundary.
        self.chapter_pattern = re.compile(r"^\s*CHAPTER\s+([MDCLXVI]+)\s*[-–—:]?\s*(.*)$")
        self.schedule_pattern = re.compile(r"^\s*SCHEDULE\s+([MDCLXVI]+)\s*[-–—:]?\s*(.*)$")
        self.regulation_pattern = re.compile(r"^\s*(\d{1,3})\.\s+(.*)$")
        self.roman_pattern = re.compile(r"^[MDCLXVI]+$")
        # Amendment footnote markers, e.g. "258[ Underwriting" or "109".
        self.footnote_pattern = re.compile(r"^\d+\s*\[?\s*")

    # ------------------------------------------------------------------ parsing

    def _parse_units(self, text: str) -> List[Dict[str, Any]]:
        """
        Scan the full document line by line and group it into hierarchy units —
        one per regulation, plus one per schedule.

        Boundaries are `CHAPTER <ROMAN>`, `SCHEDULE <ROMAN>`, and a numbered line
        `N. ` whose N advances past the highest regulation seen so far. The
        monotonic guard is what separates real regulation boundaries from the
        numbered list items inside schedules, which restart at 1 repeatedly.
        """
        units: List[Dict[str, Any]] = []
        chapter = ""
        chapter_title = ""
        highest_reg = 0
        in_schedule = False
        heading_candidate = ""
        buf: List[str] = []
        cur: Optional[Dict[str, Any]] = None

        def flush():
            if cur is not None and buf:
                body = "\n".join(buf).strip()
                if body:
                    unit = dict(cur)
                    unit["text"] = body
                    units.append(unit)

        for raw_line in text.split("\n"):
            stripped = raw_line.strip()

            match = self.chapter_pattern.match(raw_line)
            if match and not in_schedule and self.roman_pattern.match(match.group(1)):
                flush()
                buf, cur = [], None
                chapter = match.group(1)
                chapter_title = self._clean_title(match.group(2))
                heading_candidate = ""
                continue

            match = self.schedule_pattern.match(raw_line)
            if match and self.roman_pattern.match(match.group(1)):
                flush()
                buf = []
                in_schedule = True
                chapter = f"SCHEDULE {match.group(1)}"
                chapter_title = self._clean_title(match.group(2))
                cur = {
                    "chapter": chapter,
                    "chapter_title": chapter_title,
                    "regulation_number": "",
                    "regulation_title": chapter_title,
                }
                heading_candidate = ""
                continue

            if not in_schedule:
                match = self.regulation_pattern.match(raw_line)
                if match and int(match.group(1)) > highest_reg:
                    flush()
                    buf = []
                    highest_reg = int(match.group(1))
                    cur = {
                        "chapter": chapter,
                        "chapter_title": chapter_title,
                        "regulation_number": str(highest_reg),
                        "regulation_title": self._clean_title(heading_candidate),
                    }
                    buf.append(stripped)
                    heading_candidate = ""
                    continue

            if not stripped:
                continue

            if cur is None:
                # Text before the first boundary is front matter; keep the last
                # short line as the heading for whichever unit opens next.
                heading_candidate = stripped
            else:
                buf.append(stripped)
                if len(stripped) < 90 and not stripped.endswith((".", ";", ":", ",")):
                    heading_candidate = stripped

        flush()
        return units

    def _clean_title(self, title: str) -> str:
        """Strip amendment footnote markers that lead section headings."""
        cleaned = self.footnote_pattern.sub("", title.strip())
        return cleaned.strip(" []-–—").strip()

    # ----------------------------------------------------------------- chunking

    def _split_words(self, text: str, max_words: int, overlap: int) -> List[str]:
        words = text.split()
        if len(words) <= max_words:
            return [text]
        step = max(1, max_words - overlap)
        blocks = []
        for start in range(0, len(words), step):
            block = words[start:start + max_words]
            if not block:
                break
            blocks.append(" ".join(block))
            if start + max_words >= len(words):
                break
        return blocks

    def _derive_applicability(self, chapter: str, text: str) -> str:
        if chapter in _SME_CHAPTERS or _SME_TEXT_RE.search(text):
            return APPLICABILITY_SME
        return APPLICABILITY_UNSPECIFIED

    def process_text(self, text: str, source_doc: str) -> List[RegulatoryChunk]:
        logger.info(f"Chunking regulatory document: {source_doc}")

        units = self._parse_units(text)
        if not units:
            logger.warning(f"No regulatory hierarchy units parsed from {source_doc}")
            return []

        doc_slug = re.sub(r"[^A-Za-z0-9]+", "_", os.path.splitext(source_doc)[0]).strip("_")
        chunks: List[RegulatoryChunk] = []

        for unit in units:
            unit_key = (
                f"REG{unit['regulation_number']}"
                if unit["regulation_number"]
                else re.sub(r"[^A-Za-z0-9]+", "_", unit["chapter"])
            )
            applicability = self._derive_applicability(unit["chapter"], unit["text"])

            parent_blocks = self._split_words(unit["text"], PARENT_MAX_WORDS, 0)
            for p_idx, parent_text in enumerate(parent_blocks):
                parent_id = f"{doc_slug}_CH{unit['chapter'].replace(' ', '')}_{unit_key}_p{p_idx}"

                for c_idx, child_text in enumerate(
                    self._split_words(parent_text, CHILD_MAX_WORDS, CHILD_OVERLAP_WORDS)
                ):
                    clause_id = f"{parent_id}_c{c_idx}"

                    self.parent_store.store(
                        child_id=clause_id,
                        child_text=child_text,
                        parent_id=parent_id,
                        parent_text=parent_text,
                    )

                    metadata = {
                        "chapter": unit["chapter"],
                        "regulation_number": unit["regulation_number"],
                        "section": unit["regulation_title"] or unit["chapter_title"],
                    }

                    chunks.append(
                        RegulatoryChunk(
                            clause_id=clause_id,
                            parent_id=parent_id,
                            source_doc=source_doc,
                            chapter=unit["chapter"],
                            chapter_title=unit["chapter_title"],
                            regulation_number=unit["regulation_number"],
                            regulation_title=unit["regulation_title"],
                            # Left unset deliberately: nothing in this pipeline
                            # classifies disclosure category, and labelling every
                            # clause "General" is a fabricated attribute.
                            disclosure_category="",
                            applicability=applicability,
                            text=child_text,
                            enriched_text=enrich_chunk_text(child_text, metadata),
                        )
                    )

        logger.info(
            f"{source_doc}: {len(units)} hierarchy units -> {len(chunks)} chunks "
            f"({len(set(c.chapter for c in chunks))} chapters, "
            f"{len(set(c.regulation_number for c in chunks if c.regulation_number))} regulations)"
        )
        return chunks


def save_regulatory_chunks(chunks: List[RegulatoryChunk], output_dir: str):
    """Write one JSONL per source document. Previously every document was written
    to a single file named after chunks[0].source_doc, which hid the other sources."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    if not chunks:
        return

    by_doc: Dict[str, List[RegulatoryChunk]] = defaultdict(list)
    for chunk in chunks:
        by_doc[chunk.source_doc].append(chunk)

    for source_doc, doc_chunks in by_doc.items():
        output_path = os.path.join(output_dir, f"{source_doc}_reg_chunks.jsonl")
        with open(output_path, 'w', encoding='utf-8') as f:
            for chunk in doc_chunks:
                f.write(chunk.model_dump_json() + '\n')
        logger.info(f"Wrote {len(doc_chunks)} regulatory chunks to {output_path}")
