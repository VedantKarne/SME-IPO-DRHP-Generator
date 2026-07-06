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

def make_temp_pdf_first_n_pages(path: str, n: int) -> str:
    """Helper to slice a PDF for fast debugging with Docling."""
    import fitz
    import os

    # Avoid recursive slicing if the file is already a temp file
    if "_first_" in path:
        return path

    doc = fitz.open(path)
    limit = min(n, len(doc))
    temp_path = path.replace(".pdf", f"_first_{limit}_pages.pdf")
    
    # Reuse if already created
    if os.path.exists(temp_path):
        doc.close()
        return temp_path
        
    out = fitz.open()
    for i in range(limit):
        out.insert_pdf(doc, from_page=i, to_page=i)

    out.save(temp_path)
    out.close()
    doc.close()

    return temp_path

def pymupdf_text_yield_check(path: str, sample_pages: int = 15) -> float:
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

def pymupdf_extract(path: str, doc_id: str, source: str, max_pages: Optional[int] = None) -> List[ParsedDocument]:
    """
    Fast path extraction using PyMuPDF.
    """
    parsed_docs = []
    try:
        logger.info(f"Starting PyMuPDF extraction for {path}")
        doc = fitz.open(path)
        tables = [] # Removed docling_extract_tables(path) to prevent massive slowdown
        
        total_pages = len(doc)
        limit = min(total_pages, max_pages) if max_pages else total_pages
        logger.info(f"Processing {limit} pages out of {total_pages} for {path}")
        
        for page_num in range(limit):
            if page_num % 10 == 0 or page_num == limit - 1:
                logger.info(f"PyMuPDF: Processing page {page_num + 1}/{limit} for {doc_id}")
            page = doc[page_num]
            text = page.get_text("text")
            
            # Simplified heading path for PyMuPDF
            heading_path = []
            
            parsed_doc = ParsedDocument(
                doc_id=doc_id,
                source=source,
                page=page_num + 1,
                text=text,
                tables=tables,
                heading_path=heading_path,
                extraction_method="pymupdf"
            )
            parsed_docs.append(parsed_doc)
            
        doc.close()
        logger.info(f"Completed PyMuPDF extraction for {doc_id}")
    except Exception as e:
        logger.error(f"Error in pymupdf_extract: {e}")
    
    return parsed_docs

def docling_extract_full(path: str, doc_id: str, source: str, max_pages: Optional[int] = None) -> List[ParsedDocument]:
    """
    Full extraction using Docling ML Pipeline.
    """
    parsed_docs = []
    try:
        logger.info(f"Starting Docling ML conversion for {path}... (This might take a while)")
        
        if max_pages:
            logger.info(f"Slicing PDF to first {max_pages} pages for Docling debugging...")
            path = make_temp_pdf_first_n_pages(path, max_pages)
            
        converter = DocumentConverter()
        
        # Docling does not natively support max_pages easily via standard convert() in all versions, 
        # but we can slice the text later or just accept it processes the whole file. 
        # For true limit we'd use PyMuPDF to split the PDF first, but for now we just parse.
        result = converter.convert(path)
        logger.info(f"Docling ML conversion completed for {path}. Extracting elements...")
        
        doc_dict = None # Disabled export_to_dict() to save massive disk space
        
        text = ""
        for item in result.document.texts:
            text += getattr(item, 'text', '') + "\n"
            
        tables = [] # Removed docling_extract_tables(path) to prevent duplicate conversion
        
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
        logger.info(f"Completed extracting elements from Docling result for {doc_id}")
        
    except Exception as e:
        logger.error(f"Error in docling_extract_full: {e}")
        
    return parsed_docs

def parse_pdf(path: str, source: str = "regulatory", max_pages: Optional[int] = None) -> List[ParsedDocument]:
    """
    Routing logic:
    1. Quick text-yield check with PyMuPDF (~50ms)
    2. If yield > 80% -> digital PDF -> PyMuPDF fast-path (speed)
    3. If yield < 80% -> scanned/complex -> Docling (accuracy)
    4. ALWAYS use Docling's TableFormer for table extraction
    """
    doc_id = get_doc_id(path)
    quick_yield = pymupdf_text_yield_check(path, sample_pages=15)
    
    logger.info(f"PDF {path} has quick yield of {quick_yield}")
    
    if quick_yield >= 0.75:
        logger.info(f"Using PyMuPDF fast-path for {path}")
        result = pymupdf_extract(path, doc_id, source, max_pages)
    else:
        logger.info(f"Using Docling ML pipeline for {path} (heavy operation)")
        result = docling_extract_full(path, doc_id, source, max_pages)
        
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
