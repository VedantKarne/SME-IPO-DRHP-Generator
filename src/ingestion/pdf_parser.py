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

def make_temp_pdf_specific_pages(path: str, page_numbers: List[int]) -> str:
    """Helper to slice a PDF for specific pages (0-indexed)."""
    import fitz
    import os
    
    if "_sliced_" in path:
        return path
        
    doc = fitz.open(path)
    # create a stable hash for the filename based on pages
    pages_hash = hash(tuple(page_numbers))
    pages_hash = pages_hash if pages_hash > 0 else -pages_hash
    temp_path = path.replace(".pdf", f"_sliced_{pages_hash}.pdf")
    
    if os.path.exists(temp_path):
        doc.close()
        return temp_path
        
    out = fitz.open()
    for p in page_numbers:
        if 0 <= p < len(doc):
            out.insert_pdf(doc, from_page=p, to_page=p)
            
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
    Deprecated: Tables are now extracted directly during the main Docling parse or via PyMuPDF.
    """
    return []

def pymupdf_extract(path: str, doc_id: str, source: str, max_pages: Optional[int] = None, page_numbers: Optional[List[int]] = None) -> List[ParsedDocument]:
    """
    Fast path extraction using PyMuPDF.
    """
    parsed_docs = []
    try:
        logger.info(f"Starting PyMuPDF extraction for {path}")
        doc = fitz.open(path)
        
        total_pages = len(doc)
        if page_numbers is not None:
            pages_to_process = page_numbers
            limit = len(pages_to_process)
        else:
            limit = min(total_pages, max_pages) if max_pages else total_pages
            pages_to_process = list(range(limit))
            
        logger.info(f"Processing {limit} pages for {path}")
        
        for idx, page_num in enumerate(pages_to_process):
            if idx % 10 == 0 or idx == limit - 1:
                logger.info(f"PyMuPDF: Processing page {idx + 1}/{limit} (Original Page {page_num + 1}) for {doc_id}")
            page = doc[page_num]
            text = page.get_text("text")
            
            # Extract tables using PyMuPDF native functionality
            tables = []
            try:
                page_tabs = page.find_tables()
                if page_tabs and page_tabs.tables:
                    for tab in page_tabs.tables:
                        df = tab.extract()
                        if df:
                            clean_df = [[str(cell) if cell is not None else "" for cell in row] for row in df]
                            tables.append(TableData(caption="", data=clean_df))
            except Exception as e:
                logger.warning(f"Error extracting tables from PyMuPDF page {page_num}: {e}")
            
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

def docling_extract_full(path: str, doc_id: str, source: str, max_pages: Optional[int] = None, page_numbers: Optional[List[int]] = None) -> List[ParsedDocument]:
    """
    Full extraction using Docling ML Pipeline.
    """
    parsed_docs = []
    try:
        logger.info(f"Starting Docling ML conversion for {path}... (This might take a while)")
        
        if page_numbers is not None:
            logger.info(f"Slicing PDF to {len(page_numbers)} pages for Docling ML extraction...")
            path = make_temp_pdf_specific_pages(path, page_numbers)
        elif max_pages:
            logger.info(f"Slicing PDF to first {max_pages} pages for Docling debugging...")
            path = make_temp_pdf_first_n_pages(path, max_pages)
            
        converter = DocumentConverter()
        result = converter.convert(path)
        logger.info(f"Docling ML conversion completed for {path}. Extracting elements...")
        
        # Populate docling_document (exported to dict)
        doc_dict = None
        try:
            doc_dict = result.document.export_to_dict()
        except Exception as e:
            logger.warning(f"Could not export docling document to dict: {e}")
        
        def get_original_page(docling_page: int) -> int:
            if page_numbers is not None:
                idx = docling_page - 1
                if 0 <= idx < len(page_numbers):
                    return page_numbers[idx] + 1
            return docling_page
            
        pages_data = {}
        
        # Aggregate text and extract headings
        if hasattr(result.document, 'texts'):
            for item in result.document.texts:
                page_no = item.prov[0].page_no if hasattr(item, 'prov') and item.prov else 1
                orig_page = get_original_page(page_no)
                
                if orig_page not in pages_data:
                    pages_data[orig_page] = {"text": "", "tables": [], "headings": []}
                    
                text_content = getattr(item, 'text', '')
                pages_data[orig_page]["text"] += text_content + "\n"
                
                # Check for headings to populate heading_path
                label = str(getattr(item, 'label', '')).lower()
                if 'section_header' in label or 'title' in label:
                    if text_content.strip():
                        pages_data[orig_page]["headings"].append(text_content.strip())
                        
        # Extract tables
        if hasattr(result.document, 'tables'):
            for tbl in result.document.tables:
                page_no = tbl.prov[0].page_no if hasattr(tbl, 'prov') and tbl.prov else 1
                orig_page = get_original_page(page_no)
                
                if orig_page not in pages_data:
                    pages_data[orig_page] = {"text": "", "tables": [], "headings": []}
                    
                caption = getattr(tbl, 'caption', "")
                data = []
                try:
                    df = tbl.export_to_dataframe()
                    data = df.astype(str).values.tolist()
                except Exception as e:
                    logger.warning(f"Error converting Docling table to dataframe: {e}")
                    
                pages_data[orig_page]["tables"].append(TableData(caption=caption, data=data))
                
        # Build page-level ParsedDocuments
        is_first_page = True
        for page_num, data in pages_data.items():
            parsed_doc = ParsedDocument(
                doc_id=doc_id,
                source=source,
                # To save space, only attach the full doc_dict to the first extracted page chunk
                docling_document=doc_dict if is_first_page else None,
                page=page_num,
                text=data["text"].strip(),
                tables=data["tables"],
                heading_path=data["headings"],
                extraction_method="docling"
            )
            parsed_docs.append(parsed_doc)
            is_first_page = False
            
        logger.info(f"Completed extracting elements from Docling result for {doc_id}")
        
    except Exception as e:
        logger.error(f"Error in docling_extract_full: {e}")
        
    return parsed_docs


def ocr_extract(
    path: str,
    doc_id: str,
    source: str,
    page_numbers: Optional[List[int]] = None,
) -> List[ParsedDocument]:
    """
    Tertiary fallback: converts PDF pages to images and runs Tesseract OCR.
    Called only when both PyMuPDF and Docling yield < 100 avg chars/page.
    Returns ParsedDocument objects in the same format as pymupdf_extract so
    downstream ingestion code requires no modification.

    System requirements (install separately):
      macOS:   brew install tesseract poppler
      Ubuntu:  sudo apt install tesseract-ocr poppler-utils
      Windows: https://github.com/UB-Mannheim/tesseract/wiki
    """
    parsed_docs = []
    try:
        from pdf2image import convert_from_path
        import pytesseract
        from PIL import Image  # noqa: F401 — imported for type checking

        logger.info(f"[OCR Fallback] Running Tesseract on '{path}'...")
        all_pages = convert_from_path(path, dpi=300)
        pages_to_process = (
            page_numbers if page_numbers is not None else list(range(len(all_pages)))
        )

        for page_idx in pages_to_process:
            if page_idx >= len(all_pages):
                continue
            # Grayscale conversion improves Tesseract accuracy on most documents
            img = all_pages[page_idx].convert("L")
            page_text = pytesseract.image_to_string(img, lang="eng")

            parsed_docs.append(
                ParsedDocument(
                    doc_id=doc_id,
                    source=source,
                    page=page_idx + 1,
                    text=page_text.strip(),
                    tables=[],
                    heading_path=[],
                    extraction_method="tesseract_ocr",
                )
            )

        logger.info(
            f"[OCR Fallback] Extracted {len(parsed_docs)} pages via Tesseract "
            f"from '{path}'"
        )

    except ImportError as e:
        logger.error(
            f"[OCR Fallback] Missing dependency: {e}.\n"
            "  Install with: pip install pytesseract pdf2image Pillow\n"
            "  macOS:   brew install tesseract poppler\n"
            "  Ubuntu:  sudo apt install tesseract-ocr poppler-utils\n"
            "  Windows: https://github.com/UB-Mannheim/tesseract/wiki"
        )
    except Exception as e:
        logger.error(f"[OCR Fallback] Tesseract OCR failed on '{path}': {e}")

    return parsed_docs


def parse_pdf(path: str, source: str = "regulatory", max_pages: Optional[int] = None) -> List[ParsedDocument]:
    """
    Hybrid Routing logic:
    1. Iterate over all pages with PyMuPDF to check text yield per page.
    2. Digital pages (> 50 chars) -> Extracted via PyMuPDF (fast path, including basic tables).
    3. Scanned pages (< 50 chars) -> Sliced and sent to Docling (ML pipeline).
    """
    doc_id = get_doc_id(path)
    
    parsed_docs = []
    digital_pages = []
    scanned_pages = []
    
    try:
        doc = fitz.open(path)
        total_pages = len(doc)
        limit = min(total_pages, max_pages) if max_pages else total_pages
        
        for i in range(limit):
            page = doc[i]
            text = page.get_text("text").strip()
            if len(text) > 50:
                digital_pages.append(i)
            else:
                scanned_pages.append(i)
        doc.close()
        
        if digital_pages:
            logger.info(f"Using PyMuPDF fast-path for {len(digital_pages)} digital pages.")
            parsed_docs.extend(pymupdf_extract(path, doc_id, source, page_numbers=digital_pages))
            
        if scanned_pages:
            logger.info(
                f"Using Docling ML pipeline for {len(scanned_pages)} "
                "scanned/complex pages."
            )
            docling_results = docling_extract_full(
                path, doc_id, source, page_numbers=scanned_pages
            )
            # If Docling also yields sparse text, try Tesseract as final fallback
            total_chars = sum(len(d.text) for d in docling_results)
            avg_chars = total_chars / len(scanned_pages) if scanned_pages else 0
            if avg_chars < 100:
                logger.info(
                    f"Docling also sparse ({avg_chars:.0f} avg chars/page). "
                    "Attempting Tesseract OCR fallback..."
                )
                ocr_results = ocr_extract(
                    path, doc_id, source, page_numbers=scanned_pages
                )
                # Prefer OCR results if they contain more content
                if ocr_results:
                    parsed_docs.extend(ocr_results)
                else:
                    # Keep Docling output as best-effort fallback
                    parsed_docs.extend(docling_results)
            else:
                parsed_docs.extend(docling_results)

        # Sort parsed docs by page number
        parsed_docs.sort(key=lambda x: x.page)
        
    except Exception as e:
        logger.error(f"Error in hybrid parse_pdf extraction: {e}")
        
    return parsed_docs

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
