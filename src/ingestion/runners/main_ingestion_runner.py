import os
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
import gc
import json
import logging
from typing import List, Dict, Any
from tqdm import tqdm

from src.ingestion.pdf_parser import parse_pdf, save_parsed_documents, get_doc_id
from src.ingestion.regulatory_chunker import RegulatoryChunker, save_regulatory_chunks
from src.ingestion.precedent_chunker import PrecedentChunker, save_precedent_chunks
from src.config.precedent_registry import PRECEDENTS, ChapterIndex, parse_toc, selected_filenames

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

RAW_DIR = "Original_Docs"
PARSED_DIR = "Parsed_Docs"
CHUNKED_DIR = "Chunked_Docs"

# A parse that yields less than this from a real filing is a failure, not an
# empty document. Without this floor an empty artifact is written once and then
# reloaded from cache forever — which is exactly how icdr_2026_consolidated.pdf
# sat at 0 characters across every subsequent run.
MIN_USABLE_CHARS = 1000

# Documents excluded from the corpus. Keyed by filename with the reason, so the
# exclusion is auditable rather than silent.
EXCLUDED_SOURCES = {
    "icdr_2026_consolidated.pdf":
        "Vector-outline PDF (Print To PDF) requiring OCR; content is SEBI (Stock "
        "Brokers) Regulations 2026 — broker conduct, not issuer disclosure. The "
        "ICDR 2018 regulations are covered by icdr_amendments_latest_summary.pdf.",
}


def _parsed_char_count(docs) -> int:
    return sum(len(getattr(d, "text", "") or "") for d in docs)

def load_parsed_documents(filepath: str) -> List[Any]:
    """Helper to load cached parsed documents if they exist."""
    from src.ingestion.pdf_parser import ParsedDocument
    docs = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            docs.append(ParsedDocument.model_validate_json(line))
    return docs

def _select_files(directory: str, only: list) -> list:
    """List PDFs in `directory`, honouring --only filters and the exclusion list."""
    files = sorted(f for f in os.listdir(directory) if f.endswith(".pdf"))
    kept = []
    for name in files:
        if name in EXCLUDED_SOURCES:
            logger.info(f"Excluding {name}: {EXCLUDED_SOURCES[name]}")
            continue
        if only and not any(token.lower() in name.lower() for token in only):
            continue
        kept.append(name)
    return kept


def _load_or_parse(path: str, file: str, source: str, subdir: str,
                   max_pages, force_reparse: bool):
    """
    Parse a PDF, using the on-disk cache when it holds a usable result.

    The cache check used to be `os.path.exists()` alone, so an empty artifact
    was reloaded indefinitely and the underlying parse failure stayed invisible.
    """
    doc_id = get_doc_id(path)
    suffix = f"_pages_{max_pages}" if max_pages else ""
    parsed_path = os.path.join(PARSED_DIR, subdir, f"{doc_id}{suffix}.jsonl")

    if os.path.exists(parsed_path) and not force_reparse:
        cached = load_parsed_documents(parsed_path)
        chars = _parsed_char_count(cached)
        if chars >= MIN_USABLE_CHARS:
            logger.info(f"Loaded cached parse for {file} ({chars:,} chars)")
            return cached
        logger.warning(
            f"Cached parse for {file} holds only {chars} chars — discarding it "
            f"and re-parsing."
        )

    logger.info(f"Parsing {subdir} PDF: {file}")
    parsed = parse_pdf(path, source=source, max_pages=max_pages)
    chars = _parsed_char_count(parsed)
    if chars < MIN_USABLE_CHARS:
        # Fail loudly. Writing this to disk would poison the cache and every
        # later run would silently reuse an empty document.
        raise RuntimeError(
            f"Parsing '{file}' yielded only {chars} characters "
            f"(minimum {MIN_USABLE_CHARS}). The document may need OCR, or be a "
            f"vector-outline PDF with no extractable text layer. Not caching."
        )
    save_parsed_documents(parsed, os.path.join(PARSED_DIR, subdir))
    return parsed


def process_pdfs(max_pages=None, corpus="both", only=None, force_reparse=False,
                 selected_precedents_only=False):
    """
    Parse and chunk PDFs from Original_Docs into Parsed_Docs / Chunked_Docs.
    Parsing is cached; the cache is validated rather than merely present.
    """
    only = only or []
    reg_chunker = RegulatoryChunker()
    prec_chunker = PrecedentChunker()

    all_reg_chunks = []
    all_prec_chunks = []

    # ---------------------------------------------------------- regulatory
    reg_raw_dir = os.path.join(RAW_DIR, "Regulatory")
    if corpus in ("regulatory", "both") and os.path.exists(reg_raw_dir):
        for file in tqdm(_select_files(reg_raw_dir, only), desc="Regulatory"):
            path = os.path.join(reg_raw_dir, file)
            parsed_docs = _load_or_parse(path, file, "regulatory", "regulatory",
                                         max_pages, force_reparse)
            if not parsed_docs:
                continue
            full_text = "\n".join(doc.text for doc in parsed_docs)
            all_reg_chunks.extend(reg_chunker.process_text(full_text, source_doc=file))
        save_regulatory_chunks(all_reg_chunks, os.path.join(CHUNKED_DIR, "regulatory"))
    elif corpus in ("regulatory", "both"):
        logger.warning(f"Regulatory directory not found: {reg_raw_dir}")

    # ----------------------------------------------------------- precedent
    prec_raw_dir = os.path.join(RAW_DIR, "Precedents")
    if corpus in ("precedent", "both") and os.path.exists(prec_raw_dir):
        prec_filter = list(only)
        if selected_precedents_only:
            # Applied to the precedent loop only — folding it into the shared
            # `only` list would filter every regulatory file out as well.
            prec_filter = prec_filter + selected_filenames() if prec_filter else selected_filenames()
        for file in tqdm(_select_files(prec_raw_dir, prec_filter), desc="Precedents"):
            path = os.path.join(prec_raw_dir, file)
            parsed_docs = _load_or_parse(path, file, "precedent", "precedent",
                                         max_pages, force_reparse)
            if not parsed_docs:
                continue

            # Curated metadata. Filename-splitting produced company='drhps',
            # exchange='png', year='reva' and fed that into every citation.
            info = PRECEDENTS.get(file)
            if info is None:
                logger.warning(
                    f"{file} is not in the precedent registry — chunking it "
                    f"without company/year metadata. Add it to "
                    f"src/config/precedent_registry.py."
                )
            company = info.company if info else ""
            year = info.year if info else ""

            pages = [(doc.page, doc.text) for doc in parsed_docs]
            chapter_index = ChapterIndex(parse_toc(pages))
            if not chapter_index:
                logger.warning(f"No table of contents found in {file}; "
                               f"chunks will have no chapter attribution.")

            all_prec_chunks.extend(prec_chunker.process_pages(
                pages=pages,
                source_doc_id=file,
                company=company,
                year=year,
                chapter_index=chapter_index,
            ))
        save_precedent_chunks(all_prec_chunks, os.path.join(CHUNKED_DIR, "precedent"))
    elif corpus in ("precedent", "both"):
        logger.warning(f"Precedent directory not found: {prec_raw_dir}")

    return all_reg_chunks, all_prec_chunks



def index_chunks(reg_chunks, prec_chunks, batch_size=32, skip_raptor=False):
    """
    Builds the RAPTOR tree, embeds all chunks using BGE-M3, and indexes them in ChromaDB.
    Processes embeddings in batches to prevent out-of-memory (OOM) errors.
    """
    # Defer heavy ML imports until parsing is completely finished
    from src.retrieval.raptor import build_raptor_tree
    from src.retrieval.bge_m3_embedder import BGEM3Embedder
    from src.retrieval.vector_store import VectorStore
    from src.ingestion.runners.accelerated_precedent_embedder import (
        get_hardware_acceleration, 
        clear_hardware_cache, 
        embed_precedent_chunks_accelerated
    )

    logger.info("Initializing Vector Store and Embedder...")
    vector_store = VectorStore()
    
    # Initialize embedder. Note: use_fp16=True saves VRAM/RAM.
    embedder = BGEM3Embedder(use_fp16=True) 

    # 1. Build RAPTOR Tree for Regulatory Corpus
    reg_dicts = []
    for c in reg_chunks:
        # The chunk's own clause_id is already document-unique (it embeds the doc
        # slug). Prefixing source again produced a vector-store ID that no longer
        # matched the child_id the chunker wrote to ParentDocStore, so
        # expand_to_parent() never found a row and parent expansion silently
        # no-opped for the whole regulatory corpus.
        unique_id = getattr(c, 'clause_id', getattr(c, 'chunk_id', str(id(c))))

        reg_dicts.append({
            "id": unique_id,
            "text": c.enriched_text or c.text,
            "metadata": {
                "doc_type": "regulation",
                "parent_id": c.parent_id,
                "source_doc": getattr(c, 'source_doc', ''),
                "chapter": c.chapter,
                "chapter_title": getattr(c, 'chapter_title', ''),
                # Key name must match what tools.rag_search reads. It previously
                # wrote "regulation_no" while the reader looked for
                # "regulation_number", so every citation rendered "Reg N/A".
                "regulation_number": getattr(c, 'regulation_number', ''),
                "section": getattr(c, 'regulation_title', '') or getattr(c, 'chapter_title', ''),
                "applicability": getattr(c, 'applicability', ''),
                "chunk_level": "clause"
            }
        })
        
    if reg_dicts and not skip_raptor:
        logger.info("Building RAPTOR tree for regulatory chunks (This will call Groq API)...")
        raptor_tree = build_raptor_tree(reg_dicts)
        final_reg_nodes = raptor_tree.get_all_nodes()
    elif reg_dicts:
        logger.info("Skipping RAPTOR summarisation; indexing leaf clauses only.")
        final_reg_nodes = reg_dicts
    else:
        final_reg_nodes = []
        logger.warning("No regulatory chunks found to build RAPTOR tree.")

    # 2. Embed and Index Regulatory Nodes in Batches
    device, optimal_batch_size = get_hardware_acceleration()
    batch_size = optimal_batch_size # Override default with optimal hardware batch size
    
    logger.info(f"Indexing {len(final_reg_nodes)} regulatory/RAPTOR nodes on {device.upper()} in batches of {batch_size}...")
    for i in tqdm(range(0, len(final_reg_nodes), batch_size), desc=f"{device.upper()} Indexing Regulatory Nodes"):
        batch = final_reg_nodes[i:i+batch_size]
        texts = [n["text"] for n in batch]
        ids = [n["id"] for n in batch]
        metadatas = [n["metadata"] for n in batch]
        
        vectors = embedder.embed_chunks(texts, batch_size=batch_size)
        vector_store.add_chunks(
            collection_name="regulatory_clauses",
            ids=ids,
            documents=texts,
            metadatas=metadatas,
            dense_vecs=vectors["dense"],
            sparse_vecs=vectors["sparse"]
        )
        
        del vectors
        gc.collect()
        clear_hardware_cache(device)

    # 3. Embed and Index Precedent Chunks in Batches
    if prec_chunks:
        embed_precedent_chunks_accelerated(prec_chunks, vector_store, embedder, batch_size=batch_size)
    else:
        logger.warning("No precedent chunks found to index.")

    logger.info("Ingestion pipeline completed successfully.")
    
def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Parse, chunk, embed and index the regulatory and precedent corpora.",
        epilog=(
            "Examples:\n"
            "  # the configured SME precedent subset plus all regulatory docs\n"
            "  python -m src.ingestion.runners.main_ingestion_runner --selected-precedents\n\n"
            "  # quick smoke test over a few pages, no Groq calls\n"
            "  python -m src.ingestion.runners.main_ingestion_runner \\\n"
            "      --corpus regulatory --max-pages 20 --skip-raptor --parse-only\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--corpus", choices=["regulatory", "precedent", "both"], default="both")
    parser.add_argument("--only", action="append", default=[], metavar="SUBSTRING",
                        help="Only process files whose name contains this. Repeatable.")
    parser.add_argument("--selected-precedents", action="store_true",
                        help="Restrict precedents to those marked selected in the registry.")
    parser.add_argument("--max-pages", type=int, default=None,
                        help="Parse only the first N pages of each PDF (testing).")
    parser.add_argument("--skip-raptor", action="store_true",
                        help="Skip RAPTOR summarisation (avoids Groq calls).")
    parser.add_argument("--force-reparse", action="store_true",
                        help="Ignore cached parses and re-parse from the PDFs.")
    parser.add_argument("--parse-only", action="store_true",
                        help="Parse and chunk, but do not embed or index.")
    parser.add_argument("--batch-size", type=int, default=8,
                        help="Fallback embedding batch size; hardware detection may override.")
    args = parser.parse_args()

    for d in [RAW_DIR, PARSED_DIR, CHUNKED_DIR,
              os.path.join(PARSED_DIR, "regulatory"), os.path.join(PARSED_DIR, "precedent"),
              os.path.join(CHUNKED_DIR, "regulatory"), os.path.join(CHUNKED_DIR, "precedent")]:
        os.makedirs(d, exist_ok=True)

    logger.info("Starting ingestion pipeline...")
    reg_chunks, prec_chunks = process_pdfs(
        max_pages=args.max_pages,
        corpus=args.corpus,
        only=args.only,
        force_reparse=args.force_reparse,
        selected_precedents_only=args.selected_precedents,
    )

    logger.info(f"Chunked: {len(reg_chunks)} regulatory, {len(prec_chunks)} precedent")

    if not reg_chunks and not prec_chunks:
        logger.warning("No chunks generated. Are there PDFs in "
                       "Original_Docs/Regulatory and Original_Docs/Precedents?")
        return

    if args.parse_only:
        logger.info("--parse-only set; skipping embedding and indexing.")
        return

    index_chunks(reg_chunks, prec_chunks, batch_size=args.batch_size,
                 skip_raptor=args.skip_raptor)


if __name__ == "__main__":
    main()
