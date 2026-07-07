import pytest
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.extraction.schema import Base, Company, FinancialStatement, DirectorKMP, OfferDetails
from src.eligibility.checker import EligibilityEngine

# Use in-memory SQLite for fast testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_eligible_company(db_session):
    # Setup eligible mock data
    company = Company(cin="U12345MH2025PTC123456", name="TechServ Solutions Ltd")
    db_session.add(company)
    db_session.commit()
    
    # Financials (EBITDA > 100 for 2/3 years, positive net worth, paid up capital < 2500)
    f1 = FinancialStatement(company_id=company.id, fiscal_year=2024, ebitda_lakhs=150.0, net_worth_lakhs=500.0, paid_up_capital_lakhs=1000.0)
    f2 = FinancialStatement(company_id=company.id, fiscal_year=2023, ebitda_lakhs=120.0, net_worth_lakhs=350.0, paid_up_capital_lakhs=1000.0)
    f3 = FinancialStatement(company_id=company.id, fiscal_year=2022, ebitda_lakhs=50.0, net_worth_lakhs=230.0, paid_up_capital_lakhs=1000.0)
    
    # Director (no litigation)
    d1 = DirectorKMP(company_id=company.id, name="Rahul Gupta", pending_litigation=False)
    
    # Offer Details (new capital issue size)
    offer = OfferDetails(company_id=company.id, total_shares_offered=5000000, price_per_share=50) # 50L shares * Rs 10 = 500 Lakhs face value capital
    
    db_session.add_all([f1, f2, f3, d1, offer])
    db_session.commit()

    engine = EligibilityEngine(db_session)
    report = engine.check_all(str(company.id))

    assert report.eligible is True
    assert len(report.checks) == 5
    assert "ICDR_2018_Reg229_2_a" in report.regulatory_citations

def test_ineligible_kmp_litigation(db_session):
    # Setup eligible mock data but with KMP litigation
    company = Company(cin="U98765MH2025PTC654321", name="Risky Corp")
    db_session.add(company)
    db_session.commit()
    
    # Financials
    f1 = FinancialStatement(company_id=company.id, fiscal_year=2024, ebitda_lakhs=150.0, net_worth_lakhs=500.0, paid_up_capital_lakhs=1000.0)
    
    # Director (WITH litigation)
    d1 = DirectorKMP(company_id=company.id, name="Shady Director", pending_litigation=True)
    
    offer = OfferDetails(company_id=company.id, total_shares_offered=5000000, price_per_share=50)
    
    db_session.add_all([f1, d1, offer])
    db_session.commit()

    engine = EligibilityEngine(db_session)
    report = engine.check_all(str(company.id))

    assert report.eligible is False
    
    # Find the KMP check
    kmp_check = next(c for c in report.checks if c.name == "KMP Litigation Check")
    assert kmp_check.passed is False
    assert kmp_check.clause_id == "ICDR_2018_Mar2025_Amend_KMP"
    assert "Shady Director" in kmp_check.reason

def test_ineligible_ebitda(db_session):
    company = Company(cin="U11111MH2025PTC111111", name="Low Profit Corp")
    db_session.add(company)
    db_session.commit()
    
    # Only 1 year has EBITDA > 100
    f1 = FinancialStatement(company_id=company.id, fiscal_year=2024, ebitda_lakhs=110.0, net_worth_lakhs=500.0, paid_up_capital_lakhs=1000.0)
    f2 = FinancialStatement(company_id=company.id, fiscal_year=2023, ebitda_lakhs=90.0, net_worth_lakhs=350.0, paid_up_capital_lakhs=1000.0)
    f3 = FinancialStatement(company_id=company.id, fiscal_year=2022, ebitda_lakhs=50.0, net_worth_lakhs=230.0, paid_up_capital_lakhs=1000.0)
    
    db_session.add_all([f1, f2, f3])
    db_session.commit()

    engine = EligibilityEngine(db_session)
    report = engine.check_all(str(company.id))

    assert report.eligible is False
    ebitda_check = next(c for c in report.checks if c.name == "EBITDA Track Record")
    assert ebitda_check.passed is False
    assert ebitda_check.clause_id == "ICDR_2018_Reg229_2_a"

def test_ineligible_net_worth(db_session):
    company = Company(cin="U22222MH2025PTC222222", name="Negative Net Worth Corp")
    db_session.add(company)
    db_session.commit()
    
    # Latest net worth is negative
    f1 = FinancialStatement(company_id=company.id, fiscal_year=2024, ebitda_lakhs=150.0, net_worth_lakhs=-50.0, paid_up_capital_lakhs=1000.0)
    db_session.add(f1)
    db_session.commit()

    engine = EligibilityEngine(db_session)
    report = engine.check_all(str(company.id))

    assert report.eligible is False
    nw_check = next(c for c in report.checks if c.name == "Positive Net Worth")
    assert nw_check.passed is False
    assert nw_check.clause_id == "ICDR_2018_Reg229_1_b"

def test_ineligible_paid_up_capital(db_session):
    company = Company(cin="U33333MH2025PTC333333", name="Oversized Corp")
    db_session.add(company)
    db_session.commit()
    
    # Already has 2000 lakhs paid up capital
    f1 = FinancialStatement(company_id=company.id, fiscal_year=2024, ebitda_lakhs=150.0, net_worth_lakhs=500.0, paid_up_capital_lakhs=2000.0)
    # Offer adds another 600 lakhs (60,000,000 shares * Rs 10 = 600000000 Rs = 6000 Lakhs! Wait, 60L shares * 10 = 600 Lakhs)
    offer = OfferDetails(company_id=company.id, total_shares_offered=6000000, price_per_share=50) 
    
    db_session.add_all([f1, offer])
    db_session.commit()

    engine = EligibilityEngine(db_session)
    report = engine.check_all(str(company.id))

    assert report.eligible is False
    cap_check = next(c for c in report.checks if c.name == "Post-Issue Paid-Up Capital")
    assert cap_check.passed is False
    assert cap_check.clause_id == "ICDR_2018_Reg229_3"

def test_ineligible_winding_up(db_session):
    # Company has winding up petition
    company = Company(cin="U44444MH2025PTC444444", name="Winding Up Corp", dynamic_checklist={"winding_up_petition": True})
    db_session.add(company)
    db_session.commit()
    
    f1 = FinancialStatement(company_id=company.id, fiscal_year=2024, ebitda_lakhs=150.0, net_worth_lakhs=500.0, paid_up_capital_lakhs=1000.0)
    db_session.add(f1)
    db_session.commit()

    engine = EligibilityEngine(db_session)
    report = engine.check_all(str(company.id))

    assert report.eligible is False
    wu_check = next(c for c in report.checks if c.name == "No Winding Up Petition")
    assert wu_check.passed is False
    assert wu_check.clause_id == "ICDR_2018_Reg229_1_c"
