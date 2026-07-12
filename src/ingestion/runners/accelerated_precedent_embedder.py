import os
import glob
import gc
import logging
from tqdm import tqdm
import torch

from src.ingestion.runners.main_ingestion_runner import CHUNKED_DIR
from src.ingestion.precedent_chunker import PrecedentChunk
from src.retrieval.bge_m3_embedder import BGEM3Embedder
from src.retrieval.vector_store import VectorStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_hardware_acceleration():
    """Detects available hardware acceleration and returns device type and optimal batch size."""
    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        logger.info(f"Hardware Acceleration Detected: CUDA ({device_name})")
        return "cuda", 16
    elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        logger.info("Hardware Acceleration Detected: Apple Metal (MPS)")
        return "mps", 16
    else:
        logger.warning("No hardware acceleration (CUDA/MPS) detected. Falling back to CPU.")
        logger.info("For CUDA: pip install torch --index-url https://download.pytorch.org/whl/cu118")
        return "cpu", 8

def clear_hardware_cache(device):
    """Clears the VRAM cache for the specified device to prevent OOM errors."""
    if device == "cuda":
        torch.cuda.empty_cache()
    elif device == "mps":
        torch.mps.empty_cache()

def embed_precedent_chunks_accelerated(prec_chunks, vector_store, embedder, batch_size=None):
    """
    Embeds and indexes precedent chunks using the optimal hardware acceleration.
    """
    device, optimal_batch_size = get_hardware_acceleration()
    if batch_size is None:
        batch_size = optimal_batch_size
        
    logger.info(f"Indexing {len(prec_chunks)} precedent chunks on {device.upper()} in batches of {batch_size}...")
    
    prec_dicts = []
    for c in prec_chunks:
        base_id = getattr(c, 'chunk_id', str(id(c)))
        source = getattr(c, 'source_doc', 'unknown')
        unique_id = f"{source}_{base_id}"
        
        prec_dicts.append({
            "id": unique_id,
            "text": c.text,
            "metadata": {
                "doc_type": "precedent",
                "parent_id": getattr(c, 'parent_id', ''),
                "company": c.metadata.get("company", "Unknown") if hasattr(c, 'metadata') else "Unknown",
                "exchange": c.metadata.get("exchange", "SME") if hasattr(c, 'metadata') else "SME",
                "year": c.metadata.get("year", "2026") if hasattr(c, 'metadata') else "2026",
                "section": c.metadata.get("section", "") if hasattr(c, 'metadata') else ""
            }
        })
    
    for i in tqdm(range(0, len(prec_dicts), batch_size), desc=f"{device.upper()} Indexing Precedents"):
        batch = prec_dicts[i:i + batch_size]
        texts = [item["text"] for item in batch]
        
        # Embed using BGE-M3 (Automatically uses CUDA/MPS if available inside BGEM3Embedder)
        vectors = embedder.embed_chunks(texts, batch_size=batch_size)
        
        # Upsert safely
        vector_store.add_chunks(
            collection_name="precedent_chunks",
            ids=[item["id"] for item in batch],
            documents=texts,
            metadatas=[item["metadata"] for item in batch],
            dense_vecs=vectors["dense"],
            sparse_vecs=vectors["sparse"]
        )
        
        # Free memory
        del vectors
        gc.collect()
        clear_hardware_cache(device)

def load_precedent_chunks_local(filepath):
    chunks = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            chunks.append(PrecedentChunk.model_validate_json(line))
    return chunks

def main():
    chunk_files = glob.glob(os.path.join(CHUNKED_DIR, "precedent", "*.jsonl"))
    
    if not chunk_files:
        logger.error("Could not find any .jsonl files in Chunked_Docs/precedent/. Please ensure parsing finished.")
        return
        
    logger.info("Loading cached precedent chunks...")
    prec_chunks = []
    for f in chunk_files:
        prec_chunks.extend(load_precedent_chunks_local(f))
        
    logger.info(f"Loaded {len(prec_chunks)} chunks total.")
    
    logger.info("Initializing Vector Store and Embedder...")
    vector_store = VectorStore()
    embedder = BGEM3Embedder(use_fp16=True)
    
    embed_precedent_chunks_accelerated(prec_chunks, vector_store, embedder)
    
    logger.info("Hardware-accelerated embedding complete! All precedents indexed.")

if __name__ == "__main__":
    main()
