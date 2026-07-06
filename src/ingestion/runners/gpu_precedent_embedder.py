import os
import glob
import gc
import logging
from tqdm import tqdm
import torch

from src.ingestion.runners.master_ingestion_runner import CHUNKED_DIR
from src.ingestion.precedent_chunker import PrecedentChunk

def load_precedent_chunks_local(filepath):
    chunks = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            chunks.append(PrecedentChunk.model_validate_json(line))
    return chunks
from src.retrieval.bge_m3_embedder import BGEM3Embedder
from src.retrieval.vector_store import VectorStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    print(f"CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU Detected: {torch.cuda.get_device_name(0)}")
    else:
        print("WARNING: CUDA is NOT available! You are still using the CPU.")
        print("Please run: pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118")
        
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
    
    batch_size = 16 # We can increase batch size to 16 on a 4GB GPU!
    
    prec_dicts = []
    for c in prec_chunks:
        base_id = getattr(c, 'chunk_id', str(id(c)))
        source = getattr(c, 'source_doc', 'unknown')
        unique_id = f"{source}_{base_id}"
        
        prec_dicts.append({
            "id": unique_id,
            "text": c.text,
            "metadata": c.metadata
        })
        
    logger.info(f"Indexing {len(prec_dicts)} precedent chunks on GPU in batches of {batch_size}...")
    for i in tqdm(range(0, len(prec_dicts), batch_size), desc="GPU Indexing Precedents"):
        batch = prec_dicts[i:i + batch_size]
        texts = [item["text"] for item in batch]
        
        # Embed using BGE-M3 (Automatically uses CUDA)
        vectors = embedder.embed_chunks(texts, batch_size=batch_size)
        
        # Upsert safely (will overwrite/skip duplicates perfectly)
        vector_store.add_chunks(
            collection_name="precedent_chunks",
            ids=[item["id"] for item in batch],
            documents=texts,
            metadatas=[item["metadata"] for item in batch],
            dense_vecs=vectors["dense"],
            sparse_vecs=vectors["sparse"]
        )
        
        # Free VRAM
        del vectors
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
    logger.info("GPU Embedding Complete! All precedents indexed.")

if __name__ == "__main__":
    main()
