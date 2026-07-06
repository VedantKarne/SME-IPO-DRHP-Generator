import os
import re
import json
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from src.retrieval.parent_doc_store import ParentDocStore
from src.ingestion.context_enricher import enrich_chunk_text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RegulatoryChunk(BaseModel):
    clause_id: str
    parent_id: str
    source_doc: str
    chapter: str
    regulation_number: str
    disclosure_category: str
    applicability: str
    text: str
    enriched_text: str
    effective_date: Optional[str] = None
    superseded_by: Optional[str] = None

class RegulatoryChunker:
    def __init__(self, db_path: str = "parent_doc_store.db"):
        self.parent_store = ParentDocStore(db_path=db_path)
        
        # Basic regex to match Chapters and Regulations
        self.chapter_pattern = re.compile(r"^CHAPTER\s+([MDCLXVI]+)(.*?)$", re.MULTILINE | re.IGNORECASE)
        self.regulation_pattern = re.compile(r"^(\d+)\.\s*(.*?)$", re.MULTILINE)
        
    def _parse_text_to_hierarchy(self, text: str) -> List[Dict]:
        """
        A naive parser to break text into Chapters and Regulations.
        In a production scenario, this would use an LLM or an extremely robust AST parser.
        """
        hierarchy = []
        
        # For simplicity in this checkpoint, let's pretend we parsed it perfectly
        # We will split by paragraphs and just assign them to mock chapters
        lines = text.split("\n\n")
        current_chapter = "I"
        current_reg = "1"
        
        parent_buffer = []
        parent_id = "ICDR_Reg_1"
        
        for idx, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
                
            chap_match = self.chapter_pattern.match(line)
            if chap_match:
                current_chapter = chap_match.group(1)
                continue
                
            reg_match = self.regulation_pattern.match(line)
            if reg_match:
                # Save previous parent if any
                if parent_buffer:
                    hierarchy.append({
                        "type": "parent",
                        "id": parent_id,
                        "chapter": current_chapter,
                        "text": "\n".join(parent_buffer)
                    })
                    parent_buffer = []
                    
                current_reg = reg_match.group(1)
                parent_id = f"ICDR_Reg_{current_reg}"
            
            # Sub-regulations (Leaves)
            leaf_id = f"{parent_id}_{idx}"
            hierarchy.append({
                "type": "leaf",
                "id": leaf_id,
                "parent_id": parent_id,
                "chapter": current_chapter,
                "regulation": current_reg,
                "text": line
            })
            parent_buffer.append(line)
            
        if parent_buffer:
            hierarchy.append({
                "type": "parent",
                "id": parent_id,
                "chapter": current_chapter,
                "text": "\n".join(parent_buffer)
            })
            
        return hierarchy

    def process_text(self, text: str, source_doc: str) -> List[RegulatoryChunk]:
        logger.info(f"Chunking regulatory document: {source_doc}")
        
        hierarchy = self._parse_text_to_hierarchy(text)
        
        # First, store all parents
        parents = {item['id']: item['text'] for item in hierarchy if item['type'] == 'parent'}
        
        chunks = []
        for item in hierarchy:
            if item['type'] == 'leaf':
                parent_text = parents.get(item['parent_id'], item['text']) # fallback to leaf text if parent not finalized
                
                self.parent_store.store(
                    child_id=item['id'],
                    child_text=item['text'],
                    parent_id=item['parent_id'],
                    parent_text=parent_text
                )
                
                metadata = {
                    "chapter": item['chapter'],
                    "regulation": item['regulation'],
                }
                
                enriched = enrich_chunk_text(item['text'], metadata)
                
                chunk = RegulatoryChunk(
                    clause_id=item['id'],
                    parent_id=item['parent_id'],
                    source_doc=source_doc,
                    chapter=item['chapter'],
                    regulation_number=item['regulation'],
                    disclosure_category="General",  # Would be classified by LLM
                    applicability="SME_EXCHANGE",
                    text=item['text'],
                    enriched_text=enriched
                )
                chunks.append(chunk)
                
        return chunks

def save_regulatory_chunks(chunks: List[RegulatoryChunk], output_dir: str):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    if not chunks:
        return
        
    source_doc = chunks[0].source_doc
    output_path = os.path.join(output_dir, f"{source_doc}_reg_chunks.jsonl")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        for chunk in chunks:
            f.write(chunk.model_dump_json() + '\n')
