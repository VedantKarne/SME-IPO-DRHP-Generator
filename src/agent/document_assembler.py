import os
import logging
from typing import List, Dict, Any
try:
    from docx import Document
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

logger = logging.getLogger(__name__)

SEBI_TOC_ORDER = [
    "Cover Page & General Information",
    "Risk Factors",
    "Introduction / Summary of Business",
    "General Information",
    "Capital Structure",
    "Objects of the Offer",
    "Basis of Issue Price",
    "Statement of Tax Benefits",
    "About the Company / Business Overview",
    "Industry Overview",
    "Our Business",
    "Key Industry Regulations",
    "History and Corporate Structure",
    "Management & Board of Directors",
    "Key Managerial Personnel",
    "Our Promoters & Promoter Group",
    "Related Party Transactions",
    "Dividend Policy",
    "Financial Statements",
    "Management Discussion & Analysis",
    "Corporate Governance",
    "Terms of the Issue",
    "Other Regulatory & Statutory Disclosures",
    "Material Contracts & Documents",
    "Declaration & Undertakings"
]

def document_assembler_node(finalized_sections: List[Dict[str, str]], company_name: str, output_dir: str = "Output") -> str:
    """
    Sorts finalized sections by SEBI TOC order and exports to a DOCX file.
    """
    logger.info(f"Assembling DRHP document for {company_name}...")
    
    # Sort sections based on SEBI_TOC_ORDER
    def get_sort_index(section_dict: dict) -> int:
        name = section_dict.get("section_name", "")
        for i, toc_name in enumerate(SEBI_TOC_ORDER):
            if toc_name.lower() in name.lower():
                return i
        return 99 # Unknown sections go to the end
        
    sorted_sections = sorted(finalized_sections, key=get_sort_index)
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    output_path = os.path.join(output_dir, f"DRHP_{company_name.replace(' ', '_')}.docx")
    
    if not HAS_DOCX:
        logger.error("python-docx is not installed. Exporting to plain text instead.")
        txt_path = output_path.replace(".docx", ".txt")
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(f"DRAFT RED HERRING PROSPECTUS - {company_name.upper()}\n")
            f.write("="*60 + "\n\n")
            for sec in sorted_sections:
                f.write(f"### {sec.get('section_name', 'Unnamed Section')} ###\n\n")
                f.write(sec.get("draft_text", "") + "\n\n")
        return txt_path

    # Build DOCX
    doc = Document()
    doc.add_heading(f'Draft Red Herring Prospectus', 0)
    doc.add_heading(company_name.upper(), 1)
    
    doc.add_page_break()
    
    for sec in sorted_sections:
        doc.add_heading(sec.get("section_name", "Unnamed Section"), level=2)
        doc.add_paragraph(sec.get("draft_text", ""))
        doc.add_page_break()
        
    doc.save(output_path)
    logger.info(f"Document successfully exported to: {output_path}")
    
    return output_path
