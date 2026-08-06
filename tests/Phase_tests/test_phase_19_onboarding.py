"""
Structured onboarding capture (P1.7).

Onboarding used to collect five free-text chat answers, so financial_statement,
director_kmp and offer_details each held zero rows for every company. Generation
had no company facts to draft from and the eligibility engine could not evaluate
its financial checks at all.

These tests cover what the onboarding flow now writes, and the idempotency that
lets a user re-enter or correct a value without duplicating rows.
"""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.extraction.schema import (
    Base, Company, FinancialStatement, DirectorKMP, OfferDetails,
)
from src.api.server import app
from src.api import wizard
from src.api.auth_router import get_current_user

TEST_DB = "sqlite:///tests/results/test_onboarding.db"
engine = create_engine(TEST_DB, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


_acting = {"company_id": None}


def override_get_current_user():
    return {"company_id": _acting["company_id"], "sub": "onboarding-test@example.com"}


app.dependency_overrides[wizard.get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)


@pytest.fixture()
def company():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    c = Company(cin=f"U11111MH2026PLC{uuid.uuid4().hex[:6]}", name="Onboarding Fixture Ltd")
    db.add(c)
    db.commit()
    db.refresh(c)
    _acting["company_id"] = str(c.id)
    yield c
    db.close()


def _financials(year, **overrides):
    row = {
        "fiscal_year": year, "revenue_lakhs": 1000.0, "ebitda_lakhs": 150.0,
        "pat_lakhs": 90.0, "net_worth_lakhs": 500.0, "paid_up_capital_lakhs": 300.0,
    }
    row.update(overrides)
    return row


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def test_onboarding_writes_all_three_tables(company):
    """The three tables that were empty for every company before P1.7."""
    db = TestingSessionLocal()

    r = client.post(f"/api/wizard/financials/{company.id}",
                    json=[_financials(2024), _financials(2025), _financials(2026)])
    assert r.status_code == 200, r.text
    assert db.query(FinancialStatement).filter_by(company_id=company.id).count() == 3

    r = client.post(f"/api/wizard/directors/{company.id}?replace=true", json=[
        {"name": "Anita Deshpande", "din": "01234567", "designation": "Managing Director"},
        {"name": "Rohit Nair", "din": "07654321", "designation": "Independent Director",
         "pending_litigation": True, "litigation_details": "Civil suit pending"},
    ])
    assert r.status_code == 200, r.text
    assert db.query(DirectorKMP).filter_by(company_id=company.id).count() == 2

    r = client.post(f"/api/wizard/offer/{company.id}?replace=true", json={
        "total_shares_offered": 4000000, "price_per_share": 125,
        "objects_of_offer": ["Capital expenditure", "Working capital"],
    })
    assert r.status_code == 200, r.text
    # 4,000,000 shares x Rs125 = Rs500,000,000 = 5,000 lakhs
    assert r.json()["calculated_issue_size_lakhs"] == pytest.approx(5000.0)
    assert db.query(OfferDetails).filter_by(company_id=company.id).count() == 1
    db.close()


# ---------------------------------------------------------------------------
# Idempotency — a user correcting a value must not duplicate rows
# ---------------------------------------------------------------------------

def test_financials_upsert_by_fiscal_year(company):
    """
    Re-posting a year updates it. Appending produced duplicate years, and the
    eligibility engine reads financials[:3] — so duplicates silently changed its
    verdict.
    """
    db = TestingSessionLocal()
    client.post(f"/api/wizard/financials/{company.id}",
                json=[_financials(2025, revenue_lakhs=1000.0)])
    r = client.post(f"/api/wizard/financials/{company.id}",
                    json=[_financials(2025, revenue_lakhs=2222.0)])
    assert r.json()["created"] == 0 and r.json()["updated"] == 1

    rows = db.query(FinancialStatement).filter_by(company_id=company.id).all()
    assert len(rows) == 1, "re-posting the same fiscal year duplicated it"
    assert float(rows[0].revenue_lakhs) == 2222.0
    db.close()


def test_directors_replace_overwrites_the_board(company):
    db = TestingSessionLocal()
    client.post(f"/api/wizard/directors/{company.id}?replace=true",
                json=[{"name": "First Director"}])
    client.post(f"/api/wizard/directors/{company.id}?replace=true",
                json=[{"name": "Second Director"}, {"name": "Third Director"}])

    names = {d.name for d in db.query(DirectorKMP).filter_by(company_id=company.id).all()}
    assert names == {"Second Director", "Third Director"}
    db.close()


def test_directors_append_is_still_the_default(company):
    """replace defaults to False, so incremental adds keep working."""
    db = TestingSessionLocal()
    client.post(f"/api/wizard/directors/{company.id}", json=[{"name": "First"}])
    client.post(f"/api/wizard/directors/{company.id}", json=[{"name": "Second"}])
    assert db.query(DirectorKMP).filter_by(company_id=company.id).count() == 2
    db.close()


def test_offer_replace_supersedes_previous_entry(company):
    db = TestingSessionLocal()
    client.post(f"/api/wizard/offer/{company.id}?replace=true",
                json={"total_shares_offered": 1000, "price_per_share": 10})
    client.post(f"/api/wizard/offer/{company.id}?replace=true",
                json={"total_shares_offered": 2000, "price_per_share": 20})

    offers = db.query(OfferDetails).filter_by(company_id=company.id).all()
    assert len(offers) == 1
    assert float(offers[0].total_shares_offered) == 2000
    db.close()


# ---------------------------------------------------------------------------
# Authorization — these endpoints were fully unauthenticated before P0
# ---------------------------------------------------------------------------

def test_wizard_rejects_another_companys_token(company):
    original = _acting["company_id"]
    _acting["company_id"] = str(uuid.uuid4())
    try:
        for path, payload in [
            (f"/api/wizard/financials/{company.id}", [_financials(2025)]),
            (f"/api/wizard/directors/{company.id}", [{"name": "Intruder"}]),
            (f"/api/wizard/offer/{company.id}", {"total_shares_offered": 1, "price_per_share": 1}),
        ]:
            assert client.post(path, json=payload).status_code == 403, path
    finally:
        _acting["company_id"] = original


# ---------------------------------------------------------------------------
# Eligibility becomes evaluable — the point of the whole exercise
# ---------------------------------------------------------------------------

def test_eligibility_can_evaluate_once_onboarding_data_exists(company):
    """
    With no financials the engine cannot assess its numeric checks. Once
    onboarding has run, they evaluate against real figures.
    """
    from src.eligibility.checker import EligibilityEngine

    db = TestingSessionLocal()
    engine_obj = EligibilityEngine(db_session=db)

    before = engine_obj.check_all(str(company.id))
    ebitda_before = next(c for c in before.checks if "EBITDA" in c.name)
    assert not ebitda_before.passed, "should not pass without any financial data"

    client.post(f"/api/wizard/financials/{company.id}", json=[
        _financials(2024, ebitda_lakhs=250.0, net_worth_lakhs=800.0),
        _financials(2025, ebitda_lakhs=310.0, net_worth_lakhs=990.0),
        _financials(2026, ebitda_lakhs=410.0, net_worth_lakhs=1300.0),
    ])

    after = EligibilityEngine(db_session=TestingSessionLocal()).check_all(str(company.id))
    ebitda_after = next(c for c in after.checks if "EBITDA" in c.name)
    net_worth_after = next(c for c in after.checks if "Net Worth" in c.name)

    assert ebitda_after.passed, f"EBITDA check should pass: {ebitda_after.reason}"
    assert net_worth_after.passed, f"Net worth check should pass: {net_worth_after.reason}"
    db.close()
