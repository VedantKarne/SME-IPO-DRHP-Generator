import os
import json
import logging
import uuid
from typing import List, Dict, Any
from pydantic import BaseModel
from docling.document_converter import DocumentConverter
from docling.chunking import HybridChunker

from src.retrieval.parent_doc_store import ParentDocStore
from src.ingestion.context_enricher import enrich_chunk_text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PrecedentChunk(BaseModel):
    chunk_id: str
    parent_id: str
    source_doc: str
    text: str
    enriched_text: str
    metadata: Dict[str, Any]

class PrecedentChunker:
    def __init__(self, db_path: str = "Databases/parent_doc_store.db"):
        self.parent_store = ParentDocStore(db_path=db_path)
        # Using bge-m3 as tokenizer to keep tokens aligned with embedding model limits
        self.chunker = HybridChunker(
            tokenizer="BAAI/bge-m3", 
            max_tokens=512, 
            merge_peers=True
        )
        self.converter = DocumentConverter()

    def _build_parent_text(self, chunk) -> str:
        # A simple heuristic to build the parent text context if chunking provides it.
        # HybridChunker might not easily give us the "full section". 
        # But we can combine nearby chunks or just use the heading path text.
        # For this prototype, we'll just return the heading path as the parent text.
        # A more advanced version would extract all text under the same heading.
        if hasattr(chunk, 'meta') and hasattr(chunk.meta, 'headings'):
            return " > ".join(chunk.meta.headings)
        return ""

    def process_document(self, file_path: str, source_doc_id: str, company: str = "", exchange: str = "", year: str = "") -> List[PrecedentChunk]:
        """
        Legacy docling chunker. Deprecated due to double parsing overhead.
        """
        pass

    def process_text(self, text: str, source_doc_id: str, company: str = "", exchange: str = "", year: str = "") -> List[PrecedentChunk]:
        """
        Process raw text from a DRHP, chunk it, save parent-child maps, and return enriched chunks.
        Bypasses Docling to use the fast PyMuPDF extracted text.
        """
        logger.info(f"Chunking {source_doc_id} from raw text...")
        
        # Simple overlap chunking (since HybridChunker needs Docling document)
        # Using ~512 words per chunk with 50 words overlap
        words = text.split()
        chunk_size = 500
        overlap = 50
        
        precedent_chunks = []
        idx = 0
        
        for i in range(0, len(words), chunk_size - overlap):
            chunk_words = words[i:i + chunk_size]
            if not chunk_words:
                break
                
            chunk_text = " ".join(chunk_words)
            chunk_id = f"{source_doc_id}_chunk_{idx}"
            parent_id = f"{source_doc_id}_parent_{idx}"
            
            # Save to SQLite
            self.parent_store.store(
                child_id=chunk_id, 
                child_text=chunk_text, 
                parent_id=parent_id, 
                parent_text=chunk_text[:100] + "..." # Simplified parent context
            )
            
            metadata = {
                "company": company,
                "exchange": exchange,
                "year": year,
                "section": ""
            }
            
            enriched = enrich_chunk_text(chunk_text, metadata)
            
            p_chunk = PrecedentChunk(
                chunk_id=chunk_id,
                parent_id=parent_id,
                source_doc=source_doc_id,
                text=chunk_text,
                enriched_text=enriched,
                metadata=metadata
            )
            precedent_chunks.append(p_chunk)
            idx += 1
            
        return precedent_chunks

def save_precedent_chunks(chunks: List[PrecedentChunk], output_dir: str):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    if not chunks:
        return
        
    source_doc = chunks[0].source_doc
    output_path = os.path.join(output_dir, f"{source_doc}_chunks.jsonl")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        for chunk in chunks:
            f.write(chunk.model_dump_json() + '\n')
