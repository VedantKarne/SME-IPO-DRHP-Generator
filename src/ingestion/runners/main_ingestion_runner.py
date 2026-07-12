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

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

RAW_DIR = "Original_Docs"
PARSED_DIR = "Parsed_Docs"
CHUNKED_DIR = "Chunked_Docs"

def load_parsed_documents(filepath: str) -> List[Any]:
    """Helper to load cached parsed documents if they exist."""
    from src.ingestion.pdf_parser import ParsedDocument
    docs = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            docs.append(ParsedDocument.model_validate_json(line))
    return docs

def process_pdfs(max_pages=None):
    """
    Parses and chunks all PDFs from the Original_Docs directory.
    Stores intermediate results in Parsed_Docs and Chunked_Docs.
    Skips parsing if cached results exist.
    """
    reg_chunker = RegulatoryChunker()
    prec_chunker = PrecedentChunker()
    
    all_reg_chunks = []
    all_prec_chunks = []

    # Process Regulatory PDFs
    reg_raw_dir = os.path.join(RAW_DIR, "Regulatory")
    if os.path.exists(reg_raw_dir):
        files = [f for f in os.listdir(reg_raw_dir) if f.endswith(".pdf")]
        for file in tqdm(files, desc="Parsing Regulatory PDFs"):
            path = os.path.join(reg_raw_dir, file)
            doc_id = get_doc_id(path)
            
            # Incorporate max_pages into cache filename to prevent contamination
            suffix = f"_pages_{max_pages}" if max_pages else ""
            parsed_path = os.path.join(PARSED_DIR, "regulatory", f"{doc_id}{suffix}.jsonl")
            
            # 1. Parsing with Caching
            if os.path.exists(parsed_path):
                logger.info(f"Loaded cached parsed data for {file}")
                parsed_docs = load_parsed_documents(parsed_path)
            else:
                logger.info(f"Parsing regulatory PDF: {file}")
                parsed_docs = parse_pdf(path, source="regulatory", max_pages=max_pages)
                save_parsed_documents(parsed_docs, os.path.join(PARSED_DIR, "regulatory"))
            
            # 2. Chunking
            if not parsed_docs:
                logger.warning(f"Skipping chunking because parsing failed or was empty for {file}")
                continue
                
            full_text = "\n".join([doc.text for doc in parsed_docs])
            logger.info(f"Chunking regulatory PDF: {file}")
            chunks = reg_chunker.process_text(full_text, source_doc=file)
            all_reg_chunks.extend(chunks)
                
        save_regulatory_chunks(all_reg_chunks, os.path.join(CHUNKED_DIR, "regulatory"))
    else:
        logger.warning(f"Regulatory directory not found: {reg_raw_dir}")
    
    # Process Precedent PDFs
    prec_raw_dir = os.path.join(RAW_DIR, "Precedents")
    if os.path.exists(prec_raw_dir):
        files = [f for f in os.listdir(prec_raw_dir) if f.endswith(".pdf")]
        for file in tqdm(files, desc="Parsing Precedent PDFs"):
            path = os.path.join(prec_raw_dir, file)
            doc_id = get_doc_id(path)
            
            # Incorporate max_pages into cache filename
            suffix = f"_pages_{max_pages}" if max_pages else ""
            parsed_path = os.path.join(PARSED_DIR, "precedent", f"{doc_id}{suffix}.jsonl")
            
            # 1. Parsing with Caching
            if os.path.exists(parsed_path):
                logger.info(f"Loaded cached parsed data for {file}")
                parsed_docs = load_parsed_documents(parsed_path)
            else:
                logger.info(f"Parsing precedent PDF: {file}")
                parsed_docs = parse_pdf(path, source="precedent", max_pages=max_pages)
                save_parsed_documents(parsed_docs, os.path.join(PARSED_DIR, "precedent"))
            
            # 2. Chunking
            if not parsed_docs:
                logger.warning(f"Skipping chunking because parsing failed or was empty for {file}")
                continue
                
            logger.info(f"Chunking precedent PDF: {file}")
            parts = file.replace(".pdf", "").split("_")
            company = parts[0] if len(parts) > 0 else "Unknown"
            exchange = parts[1] if len(parts) > 1 else "SME"
            year = parts[2] if len(parts) > 2 else "2026"
            
            full_text = "\n".join([doc.text for doc in parsed_docs])
            chunks = prec_chunker.process_text(
                text=full_text, 
                source_doc_id=file, 
                company=company, 
                exchange=exchange, 
                year=year
            )
            all_prec_chunks.extend(chunks)
                
        save_precedent_chunks(all_prec_chunks, os.path.join(CHUNKED_DIR, "precedent"))
    else:
        logger.warning(f"Precedent directory not found: {prec_raw_dir}")
        
    return all_reg_chunks, all_prec_chunks

def index_chunks(reg_chunks, prec_chunks, batch_size=32):
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
        base_id = getattr(c, 'clause_id', getattr(c, 'chunk_id', str(id(c))))
        source = getattr(c, 'source_doc', 'unknown')
        unique_id = f"{source}_{base_id}"
        
        reg_dicts.append({
            "id": unique_id,
            "text": c.text,
            "metadata": {
                "doc_type": "regulation",
                "parent_id": f"{source}_{c.parent_id}",
                "chapter": c.chapter,
                "regulation_no": getattr(c, 'regulation_number', getattr(c, 'regulation_no', '')),
                "chunk_level": "clause"
            }
        })
        
    if reg_dicts:
        logger.info("Building RAPTOR tree for regulatory chunks (This will call Groq API)...")
        raptor_tree = build_raptor_tree(reg_dicts)
        final_reg_nodes = raptor_tree.get_all_nodes()
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
    
if __name__ == "__main__":
    dirs_to_create = [
        RAW_DIR, 
        PARSED_DIR, 
        CHUNKED_DIR, 
        os.path.join(PARSED_DIR, "regulatory"), 
        os.path.join(PARSED_DIR, "precedent"),
        os.path.join(CHUNKED_DIR, "regulatory"),
        os.path.join(CHUNKED_DIR, "precedent")
    ]
    for d in dirs_to_create:
        os.makedirs(d, exist_ok=True)
        
    logger.info("Starting Master Ingestion Pipeline...")
    
    # TIP: For testing, change max_pages to 5 to avoid long Docling parsing times on massive PDFs
    reg_chunks, prec_chunks = process_pdfs(max_pages=None)
    
    if not reg_chunks and not prec_chunks:
        logger.warning("No chunks generated. Did you place PDFs in Original_Docs/Regulatory and Original_Docs/Precedents?")
    else:
        index_chunks(reg_chunks, prec_chunks, batch_size=8)
