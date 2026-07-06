import os
import json
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import fitz  # PyMuPDF
from docling.document_converter import DocumentConverter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TableData(BaseModel):
    caption: str
    data: List[List[str]]

class ParsedDocument(BaseModel):
    doc_id: str
    source: str
    docling_document: Optional[Dict[Any, Any]] = None
    page: int
    text: str
    tables: List[TableData] = []
    heading_path: List[str] = []
    extraction_method: str

def get_doc_id(path: str) -> str:
    return os.path.splitext(os.path.basename(path))[0]

def pymupdf_text_yield_check(path: str, sample_pages: int = 5) -> float:
    """
    Check what percentage of the sampled pages have extractable text.
    If a page has > 50 characters of text, we consider it has text yield.
    Returns the ratio (0.0 to 1.0).
    """
    try:
        doc = fitz.open(path)
        total_pages_to_check = min(len(doc), sample_pages)
        if total_pages_to_check == 0:
            return 0.0
            
        pages_with_text = 0
        for i in range(total_pages_to_check):
            page = doc[i]
            text = page.get_text("text").strip()
            if len(text) > 50:
                pages_with_text += 1
                
        doc.close()
        return pages_with_text / total_pages_to_check
    except Exception as e:
        logger.error(f"Error checking text yield with PyMuPDF: {e}")
        return 0.0

def docling_extract_tables(path: str) -> List[TableData]:
    """
    Always use Docling to extract tables, as it uses TableFormer which is highly accurate.
    """
    tables = []
    try:
        converter = DocumentConverter()
        result = converter.convert(path)
        # Parse the docling document object to extract tables
        if hasattr(result.document, 'tables'):
            for tbl in result.document.tables:
                # Docling table extraction logic depending on Docling version
                # Simplified version here, docling API might require specific parsing
                caption = getattr(tbl, 'caption', "")
                data = []
                # Placeholder for actual docling table cell extraction
                tables.append(TableData(caption=caption, data=data))
    except Exception as e:
        logger.error(f"Error extracting tables with Docling: {e}")
    return tables

def pymupdf_extract(path: str, doc_id: str, source: str) -> List[ParsedDocument]:
    """
    Fast path extraction using PyMuPDF.
    """
    parsed_docs = []
    try:
        doc = fitz.open(path)
        tables = docling_extract_tables(path)
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")
            
            # Simplified heading path for PyMuPDF
            heading_path = []
            
            parsed_doc = ParsedDocument(
                doc_id=doc_id,
                source=source,
                page=page_num + 1,
                text=text,
                tables=tables, # Storing all tables here or page specific? Let's assume page specific logic needs more refinement.
                heading_path=heading_path,
                extraction_method="pymupdf"
            )
            parsed_docs.append(parsed_doc)
            
        doc.close()
    except Exception as e:
        logger.error(f"Error in pymupdf_extract: {e}")
    
    return parsed_docs

def docling_extract_full(path: str, doc_id: str, source: str) -> List[ParsedDocument]:
    """
    Full extraction using Docling ML Pipeline.
    """
    parsed_docs = []
    try:
        converter = DocumentConverter()
        result = converter.convert(path)
        
        doc_dict = result.document.export_to_dict()
        
        # Simplified: one big parsed document, or split by some logical chunk
        # In a real app we'd traverse the document elements and map them to pages
        # But for this checkpoint we'll just extract all text
        text = ""
        for item in result.document.texts:
            text += getattr(item, 'text', '') + "\n"
            
        tables = docling_extract_tables(path)
        
        parsed_doc = ParsedDocument(
            doc_id=doc_id,
            source=source,
            docling_document=doc_dict,
            page=1, # Default to 1 if we collapse
            text=text,
            tables=tables,
            heading_path=[],
            extraction_method="docling"
        )
        parsed_docs.append(parsed_doc)
        
    except Exception as e:
        logger.error(f"Error in docling_extract_full: {e}")
        
    return parsed_docs

def parse_pdf(path: str, source: str = "regulatory") -> List[ParsedDocument]:
    """
    Routing logic:
    1. Quick text-yield check with PyMuPDF (~50ms)
    2. If yield > 80% -> digital PDF -> PyMuPDF fast-path (speed)
    3. If yield < 80% -> scanned/complex -> Docling (accuracy)
    4. ALWAYS use Docling's TableFormer for table extraction
    """
    doc_id = get_doc_id(path)
    quick_yield = pymupdf_text_yield_check(path)
    
    logger.info(f"PDF {path} has quick yield of {quick_yield}")
    
    if quick_yield > 0.80:
        logger.info(f"Using PyMuPDF fast-path for {path}")
        result = pymupdf_extract(path, doc_id, source)
    else:
        logger.info(f"Using Docling ML pipeline for {path}")
        result = docling_extract_full(path, doc_id, source)
        
    return result

def save_parsed_documents(parsed_docs: List[ParsedDocument], output_dir: str):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    if not parsed_docs:
        return
        
    doc_id = parsed_docs[0].doc_id
    output_path = os.path.join(output_dir, f"{doc_id}.jsonl")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        for doc in parsed_docs:
            f.write(doc.model_dump_json() + '\n')
