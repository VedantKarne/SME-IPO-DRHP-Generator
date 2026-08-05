import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.extraction.schema import Base, FinancialStatement, DirectorKMP, Company
from src.api.server import app
from src.api import wizard
from src.api.auth_router import get_current_user
from src.eligibility.checker import EligibilityEngine

import os
from datetime import datetime

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
TEST_RESULT_DIR = f"tests/results/phase_0_run_{timestamp}"
if not os.path.exists(TEST_RESULT_DIR):
    os.makedirs(TEST_RESULT_DIR)

# Test DB Setup
SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_RESULT_DIR}/test_wizard.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[wizard.get_db] = override_get_db

# The wizard endpoints now require authentication, and the per-company ones
# additionally require the caller's token to be scoped to that company. These
# tests exercise wizard logic, not auth, so stand in a token whose company_id
# the test controls. `test_wizard_requires_auth` below covers the guard itself.
_acting_company = {"id": None}


def override_get_current_user():
    return {"company_id": _acting_company["id"], "sub": "wizard-test@example.com"}


app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)


def _create_company(**kwargs):
    """Create a company and scope the acting token to it."""
    resp = client.post("/api/wizard/company", json=kwargs)
    assert resp.status_code == 200, resp.text
    company_id = resp.json()["id"]
    _acting_company["id"] = company_id
    return company_id

@pytest.fixture(autouse=True)
def run_around_tests():
    # Setup
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    # Teardown

def test_wizard_step_1_create_company():
    response = client.post("/api/wizard/company", json={
        "cin": "U72200MH2020PTC123456",
        "name": "TechServ Solutions Pvt Ltd",
        "business_activity_nic": "6201"
    })
    assert response.status_code == 200
    assert "id" in response.json()
    
    # Check duplicate CIN
    response2 = client.post("/api/wizard/company", json={
        "cin": "U72200MH2020PTC123456",
        "name": "Another Company"
    })
    assert response2.status_code == 400

def test_wizard_step_2_financials():
    company_id = _create_company(cin="U123", name="Test")
    
    response = client.post(f"/api/wizard/financials/{company_id}", json=[
        {"fiscal_year": 2022, "revenue_lakhs": 500, "ebitda_lakhs": 50},
        {"fiscal_year": 2023, "revenue_lakhs": 1000, "ebitda_lakhs": 120},
        {"fiscal_year": 2024, "revenue_lakhs": 1500, "ebitda_lakhs": 250, "net_worth_lakhs": 800}
    ])
    assert response.status_code == 200
    assert "Added 3 financial statements" in response.json()["message"]

def test_wizard_step_3_directors():
    company_id = _create_company(cin="U124", name="Test Dir")
    
    response = client.post(f"/api/wizard/directors/{company_id}", json=[
        {"name": "John Doe", "pending_litigation": False},
        {"name": "Jane Smith", "pending_litigation": True, "litigation_details": "Tax dispute"}
    ])
    assert response.status_code == 200
    assert "Added 2 directors/KMPs" in response.json()["message"]

def test_wizard_step_4_and_5_offer():
    company_id = _create_company(cin="U125", name="Test Offer")
    
    response = client.post(f"/api/wizard/offer/{company_id}", json={
        "total_shares_offered": 1000000,
        "price_per_share": 150.0,
        "objects_of_offer": ["Working Capital", "General Corporate Purposes"]
    })
    assert response.status_code == 200
    assert response.json()["calculated_issue_size_lakhs"] == 1500.0

def test_generated_section_table_exists():
    from src.extraction.schema import GeneratedSection
    db = TestingSessionLocal()
    try:
        # Just query the table to ensure it exists (limit 1)
        # Should not raise any OperationalError
        result = db.query(GeneratedSection).limit(1).all()
        assert isinstance(result, list)
    finally:
        db.close()



# ---------------------------------------------------------------------------
# Authorization guards
#
# These endpoints were previously unauthenticated: anyone could create a
# company or write financials, directors and offer details for any company.
# ---------------------------------------------------------------------------

def test_wizard_requires_auth():
    """Without a token every wizard write must be rejected."""
    app.dependency_overrides.pop(get_current_user, None)
    try:
        unauth = TestClient(app)
        # HTTPBearer answers 401 or 403 depending on the route; both mean the
        # request was rejected before reaching any handler.
        rejected = (401, 403)
        assert unauth.post(
            "/api/wizard/company", json={"cin": "U999", "name": "No Auth"}
        ).status_code in rejected
        for path, payload in [
            ("/api/wizard/financials/00000000-0000-0000-0000-000000000001", []),
            ("/api/wizard/directors/00000000-0000-0000-0000-000000000001", []),
            ("/api/wizard/offer/00000000-0000-0000-0000-000000000001",
             {"total_shares_offered": 1, "price_per_share": 1.0}),
        ]:
            assert unauth.post(path, json=payload).status_code in rejected, path
    finally:
        app.dependency_overrides[get_current_user] = override_get_current_user


def test_wizard_rejects_other_companys_token():
    """A valid token for company A must not write to company B."""
    company_id = _create_company(cin="U777", name="Company A")

    # Act as a different company while targeting company A's records.
    _acting_company["id"] = "00000000-0000-0000-0000-0000000000ff"
    try:
        resp = client.post(
            f"/api/wizard/financials/{company_id}",
            json=[{"fiscal_year": 2024, "revenue_lakhs": 1}],
        )
        assert resp.status_code == 403, resp.text
    finally:
        _acting_company["id"] = company_id
