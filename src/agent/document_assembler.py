import os
import uuid
from sqlalchemy.orm import Session
from src.extraction.schema import GeneratedSection
from docx import Document
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

# Hardcoded ordering map based on SEBI DRHP TOC
SEBI_TOC_ORDER = {
    "Cover Page & General Information": 1,
    "Risk Factors": 2,
    "Introduction": 3,
    "General Information": 4,
    "Capital Structure": 5,
    "Objects of the Offer": 6,
    "Basis of Issue Price": 7,
    "Statement of Tax Benefits": 8,
    "About the Company": 9,
    "Industry Overview": 10,
    "Our Business": 11,
    "Key Industry Regulations": 12,
    "History and Corporate Structure": 13,
    "Management & Board of Directors": 14,
    "Key Managerial Personnel (KMP)": 15,
    "Our Promoters & Promoter Group": 16,
    "Related Party Transactions": 17,
    "Dividend Policy": 18,
    "Financial Statements (3 Years)": 19,
    "Management Discussion & Analysis": 20,
    "Corporate Governance": 21,
    "Terms of the Issue": 22,
    "Other Regulatory & Statutory Disclosures": 23,
    "Material Contracts & Documents": 24,
    "Declaration & Undertakings": 25
}

def sort_by_sebi_toc(sections: list[GeneratedSection]) -> list[GeneratedSection]:
    """Sorts sections by their canonical SEBI position, defaulting to 99 if unknown."""
    return sorted(sections, key=lambda s: SEBI_TOC_ORDER.get(s.section_name, 99))

def build_docx(sections: list[GeneratedSection], output_path: str):
    """Builds a .docx file containing the finalized sections and citations."""
    doc = Document()
    doc.add_heading("SME IPO Draft Red Herring Prospectus (DRHP)", 0)
    
    for sec in sections:
        doc.add_heading(sec.section_name, level=1)
        doc.add_paragraph(sec.draft_text)
        
        # Add citations as footnotes/end of section
        if sec.supporting_clause_ids:
            citation_p = doc.add_paragraph()
            citation_p.add_run("Regulatory Citations: ").bold = True
            citation_p.add_run(", ".join(sec.supporting_clause_ids))
            
        doc.add_page_break()
        
    doc.save(output_path)

def build_pdf(sections: list[GeneratedSection], output_path: str):
    """Builds a simpler PDF using ReportLab for the hackathon demo."""
    doc = SimpleDocTemplate(output_path, pagesize=letter)
    styles = getSampleStyleSheet()
    Story = []
    
    Story.append(Paragraph("SME IPO Draft Red Herring Prospectus (DRHP)", styles['Title']))
    Story.append(Spacer(1, 12))
    
    for sec in sections:
        Story.append(Paragraph(sec.section_name, styles['Heading1']))
        Story.append(Spacer(1, 12))
        
        # We need to replace newlines with <br/> for ReportLab Paragraphs
        safe_text = sec.draft_text.replace('\n', '<br/>')
        Story.append(Paragraph(safe_text, styles['Normal']))
        Story.append(Spacer(1, 12))
        
        if sec.supporting_clause_ids:
            citations = "<b>Regulatory Citations:</b> " + ", ".join(sec.supporting_clause_ids)
            Story.append(Paragraph(citations, styles['Normal']))
            
        Story.append(Spacer(1, 24))
        
    doc.build(Story)

def document_assembler_node(company_id: str, db: Session) -> dict:
    """
    1. Fetch all finalized sections from generated_section table.
    2. Sort by SEBI DRHP Table of Contents order.
    3. Export to: (a) python-docx DOCX, (b) reportlab PDF.
    4. Return local file paths.
    """
    try:
        comp_uuid = uuid.UUID(str(company_id))
    except ValueError:
        raise ValueError(f"Invalid company UUID: {company_id}")
        
    # In a real app we'd filter by status IN ('promoter_reviewed', 'intermediary_certified')
    # For Phase 10 demo testing, we'll just fetch all sections for the company.
    sections = db.query(GeneratedSection).filter(
        GeneratedSection.company_id == comp_uuid
    ).all()
    
    if not sections:
        return {"error": "No sections found for assembly"}
        
    ordered_sections = sort_by_sebi_toc(sections)
    
    # Create exports directory if it doesn't exist
    export_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "exports")
    os.makedirs(export_dir, exist_ok=True)
    
    docx_path = os.path.join(export_dir, f"DRHP_{company_id}.docx")
    pdf_path = os.path.join(export_dir, f"DRHP_{company_id}.pdf")
    
    build_docx(ordered_sections, docx_path)
    build_pdf(ordered_sections, pdf_path)
    
    return {
        "status": "success",
        "docx_path": docx_path,
        "pdf_path": pdf_path,
        "sections_included": len(ordered_sections)
    }
