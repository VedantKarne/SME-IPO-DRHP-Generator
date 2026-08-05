import pytest
from fastapi.testclient import TestClient
import uuid
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.api.server import app, SessionLocal
from src.api.auth_router import get_current_user
from src.extraction.schema import GeneratedSection, ChatMessage, Company

# These endpoints now require a token scoped to the section's company. The
# tests here exercise locking/chat/impact behaviour rather than auth, so stand
# in a token the test controls; `test_approve_requires_auth` covers the guard.
_acting_company = {"id": None}


def override_get_current_user():
    return {"company_id": _acting_company["id"], "sub": "phase9-test@example.com"}


app.dependency_overrides[get_current_user] = override_get_current_user

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
    _acting_company["id"] = str(section.company_id)
    
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
    _acting_company["id"] = str(section.company_id)

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


def test_approve_requires_auth(setup_db):
    """
    Section approval is the regulatory sign-off action. It was previously
    unauthenticated — any anonymous caller could mark any section
    'intermediary_certified'.
    """
    section, _ = setup_db

    app.dependency_overrides.pop(get_current_user, None)
    try:
        unauth = TestClient(app)
        resp = unauth.post(f"/api/sections/{section.id}/approve")
        assert resp.status_code in (401, 403), resp.text
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_approve_rejects_other_companys_token(setup_db):
    """A token for another company must not certify this company's section."""
    section, _ = setup_db
    original = _acting_company["id"]
    _acting_company["id"] = "00000000-0000-0000-0000-0000000000ff"
    try:
        resp = client.post(f"/api/sections/{section.id}/approve")
        assert resp.status_code == 403, resp.text
    finally:
        _acting_company["id"] = original
