import pytest
from fastapi.testclient import TestClient
import uuid
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.api.server import app, SessionLocal
from src.extraction.schema import GeneratedSection, ChatMessage, Company

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    db = SessionLocal()
    # Create mock company
    company = Company(cin="U12345MH2024PLC123456", name="Phase 9 Test Corp")
    db.add(company)
    db.commit()
    db.refresh(company)
    
    # Create mock section
    section = GeneratedSection(
        company_id=company.id,
        section_name="Capital Structure",
        draft_text="The authorized share capital is 100 Lakhs.",
        status="draft",
        is_locked=False
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    
    yield section, db
    
    # Cleanup
    db.delete(section)
    db.delete(company)
    db.commit()
    db.close()

def test_chat_edit(setup_db):
    section, db = setup_db
    
    response = client.post(
        f"/api/sections/{section.id}/chat",
        json={"prompt": "Make it sound more professional"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "new_draft_text" in data
    assert data["new_draft_text"] != "The authorized share capital is 100 Lakhs."
    
    # Verify chat message was saved
    messages = db.query(ChatMessage).filter(ChatMessage.section_id == section.id).all()
    assert len(messages) == 2 # 1 user, 1 assistant

def test_locking_mechanism(setup_db):
    section, _ = setup_db
    
    # 1. Lock the section
    response = client.post(f"/api/sections/{section.id}/approve")
    assert response.status_code == 200
    assert response.json()["is_locked"] == True
    assert response.json()["status"] == "intermediary_certified"
    
    # 2. Try to edit it again
    response_blocked = client.post(
        f"/api/sections/{section.id}/chat",
        json={"prompt": "Make it shorter"}
    )
    assert response_blocked.status_code == 403
    assert "locked" in response_blocked.json()["detail"]

def test_impact_analysis():
    response = client.get("/api/impact/total_issue_size_lakhs")
    assert response.status_code == 200
    data = response.json()
    assert data["changed_field"] == "total_issue_size_lakhs"
    assert "Capital Structure" in data["affected_sections"]
    assert len(data["affected_sections"]) == 3
