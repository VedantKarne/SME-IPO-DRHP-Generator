import pytest
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.utils.demo_generator import SyntheticPromoterGenerator
from src.agent.document_assembler import document_assembler_node
from src.api.server import SessionLocal
from src.extraction.schema import GeneratedSection

@pytest.fixture(scope="module")
def setup_db():
    db = SessionLocal()
    generator = SyntheticPromoterGenerator()
    company, financials, directors, offer = generator.generate()
    
    db.add(company)
    db.add_all(financials)
    db.add_all(directors)
    db.add(offer)
    db.commit()
    db.refresh(company)
    
    # Mock finalized sections
    sections = [
        GeneratedSection(
            company_id=company.id,
            section_name="Risk Factors",
            draft_text="The company faces significant litigation risks.",
            status="intermediary_certified",
            is_locked=True,
            supporting_clause_ids=["ICDR_Reg_237"]
        ),
        GeneratedSection(
            company_id=company.id,
            section_name="Capital Structure",
            draft_text="The authorized capital is 500 Lakhs.",
            status="intermediary_certified",
            is_locked=True,
            supporting_clause_ids=["ICDR_Reg_233"]
        )
    ]
    db.add_all(sections)
    db.commit()
    
    yield company.id, db
    
    # Cleanup
    db.delete(company) # cascade should handle the rest
    db.commit()
    db.close()

def test_document_assembler_e2e(setup_db):
    company_id, db = setup_db
    
    result = document_assembler_node(company_id, db)
    
    assert result["status"] == "success"
    assert result["sections_included"] == 2
    
    docx_path = result["docx_path"]
    pdf_path = result["pdf_path"]
    
    assert os.path.exists(docx_path)
    assert os.path.exists(pdf_path)
    
    # Cleanup exported files
    os.remove(docx_path)
    os.remove(pdf_path)
