import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.extraction.schema import Base, FinancialStatement, DirectorKMP, Company
from src.api.server import app
from src.api import wizard
from src.agents.eligibility_checker import EligibilityEngine

# Test DB Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_wizard.db"
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

client = TestClient(app)

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
    # Create company first
    resp = client.post("/api/wizard/company", json={"cin": "U123", "name": "Test"})
    company_id = resp.json()["id"]
    
    response = client.post(f"/api/wizard/financials/{company_id}", json=[
        {"fiscal_year": 2022, "revenue_lakhs": 500, "ebitda_lakhs": 50},
        {"fiscal_year": 2023, "revenue_lakhs": 1000, "ebitda_lakhs": 120},
        {"fiscal_year": 2024, "revenue_lakhs": 1500, "ebitda_lakhs": 250, "net_worth_lakhs": 800}
    ])
    assert response.status_code == 200
    assert "Added 3 financial statements" in response.json()["message"]

def test_eligibility_engine():
    engine = EligibilityEngine()
    company = Company(cin="U1", name="Test")
    
    # Valid financials
    financials_valid = [
        FinancialStatement(fiscal_year=2022, ebitda_lakhs=150),
        FinancialStatement(fiscal_year=2023, ebitda_lakhs=120),
        FinancialStatement(fiscal_year=2024, ebitda_lakhs=250, net_worth_lakhs=800)
    ]
    
    directors_valid = [
        DirectorKMP(name="Ramesh", pending_litigation=False)
    ]
    
    report = engine.check_all(company, financials_valid, directors_valid)
    assert report.eligible == True
    
    # Invalid financials (EBITDA < 1Cr in 2 years)
    financials_invalid = [
        FinancialStatement(fiscal_year=2022, ebitda_lakhs=50),
        FinancialStatement(fiscal_year=2023, ebitda_lakhs=90),
        FinancialStatement(fiscal_year=2024, ebitda_lakhs=250, net_worth_lakhs=800)
    ]
    
    report_invalid = engine.check_all(company, financials_invalid, directors_valid)
    assert report_invalid.eligible == False
    assert "ICDR_2018_Reg229_2_a" in report_invalid.regulatory_citations
    
    # Invalid director (Litigation)
    directors_invalid = [
        DirectorKMP(name="Suresh", pending_litigation=True)
    ]
    
    report_invalid_dir = engine.check_all(company, financials_valid, directors_invalid)
    assert report_invalid_dir.eligible == False
    assert "ICDR_2018_Reg238_1_vi_amd" in report_invalid_dir.regulatory_citations
