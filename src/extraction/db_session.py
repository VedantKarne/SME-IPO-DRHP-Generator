import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.extraction.schema import Base

# Target Databases/app_state.db in the project root
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_DIR = os.path.join(ROOT_DIR, "Databases")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "app_state.db")

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def run_migrations():
    """
    Applies additive schema migrations for columns that were added after the
    initial DB was created. Safe to re-run — each ALTER is inside a try/except
    so duplicate-column errors are silently ignored.

    Pattern: always use 'ALTER TABLE ... ADD COLUMN ...' style migrations.
    Never drop or rename columns here — use a proper migration tool for that.
    """
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    migrations = [
        # generated_section: updated_at added in a later schema revision
        "ALTER TABLE generated_section ADD COLUMN updated_at DATETIME",
        # generated_section: langgraph_thread_id added later
        "ALTER TABLE generated_section ADD COLUMN langgraph_thread_id VARCHAR(36)",
        # financial_statement: source column added later
        "ALTER TABLE financial_statement ADD COLUMN source VARCHAR(20) DEFAULT 'promoter_input'",
        # company: dynamic_checklist added later
        "ALTER TABLE company ADD COLUMN dynamic_checklist JSON",
        # company_user: last_login added later
        "ALTER TABLE company_user ADD COLUMN last_login DATETIME",
        # company_user: is_active added later
        "ALTER TABLE company_user ADD COLUMN is_active BOOLEAN DEFAULT 1",
        # readiness_score: created_at added later
        "ALTER TABLE readiness_score ADD COLUMN created_at DATETIME",
        # readiness_score: sub-scores added later
        "ALTER TABLE readiness_score ADD COLUMN documents_score INTEGER",
        "ALTER TABLE readiness_score ADD COLUMN financials_score INTEGER",
        "ALTER TABLE readiness_score ADD COLUMN compliance_score INTEGER",
        "ALTER TABLE readiness_score ADD COLUMN legal_score INTEGER",
        "ALTER TABLE readiness_score ADD COLUMN risk_score INTEGER",
        "ALTER TABLE readiness_score ADD COLUMN next_action TEXT",
    ]
    for sql in migrations:
        try:
            cursor.execute(sql)
        except sqlite3.OperationalError:
            pass  # Column already exists — that's fine
    conn.commit()
    conn.close()

def seed_demo_user():
    """
    Seeds a default demo company and user (demo@nirmaan.ai / demo123) with
    complete financial records, offer details, and director info so judges
    and reviewers can log in instantly with rich demo data.
    """
    import bcrypt
    db = SessionLocal()
    try:
        from src.extraction.schema import Company, CompanyUser, FinancialStatement, OfferDetails, DirectorKMP

        demo_email = "demo@nirmaan.ai"
        demo_pwd = "demo123"
        hashed_pwd = bcrypt.hashpw(demo_pwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        # Find or create demo company
        company = db.query(Company).filter(Company.cin == "U72200MH2021PTC123456").first()
        if not company:
            company = Company(
                name="Nirmaan Technologies Ltd",
                cin="U72200MH2021PTC123456",
                incorporation_date=None,
                registered_office="Plot 42, Tech Park, Pune, Maharashtra 411057",
                source="demo_seed"
            )
            db.add(company)
            db.commit()
            db.refresh(company)

        # Find or create/update demo user
        user = db.query(CompanyUser).filter(CompanyUser.email == demo_email).first()
        if not user:
            user = CompanyUser(
                company_id=company.id,
                email=demo_email,
                hashed_password=hashed_pwd,
                role="promoter"
            )
            db.add(user)
            db.commit()
        else:
            # Ensure password is standard demo123
            user.hashed_password = hashed_pwd
            user.company_id = company.id
            db.commit()

        # Seed 3 years of financials if not present
        existing_fins = db.query(FinancialStatement).filter(FinancialStatement.company_id == company.id).count()
        if existing_fins == 0:
            fin_records = [
                FinancialStatement(company_id=company.id, fiscal_year=2022, revenue_lakhs=1200.0, ebitda_lakhs=180.0, pat_lakhs=120.0, net_worth_lakhs=450.0, paid_up_capital_lakhs=300.0, source="demo_seed"),
                FinancialStatement(company_id=company.id, fiscal_year=2023, revenue_lakhs=1650.0, ebitda_lakhs=260.0, pat_lakhs=175.0, net_worth_lakhs=625.0, paid_up_capital_lakhs=300.0, source="demo_seed"),
                FinancialStatement(company_id=company.id, fiscal_year=2024, revenue_lakhs=2300.0, ebitda_lakhs=410.0, pat_lakhs=290.0, net_worth_lakhs=915.0, paid_up_capital_lakhs=300.0, source="demo_seed"),
            ]
            db.add_all(fin_records)

        # Seed Offer Details if not present
        existing_offer = db.query(OfferDetails).filter(OfferDetails.company_id == company.id).first()
        if not existing_offer:
            offer = OfferDetails(
                company_id=company.id,
                total_shares_offered=5000000,
                price_per_share=100,
                total_issue_size_lakhs=5000.0,
                objects_of_offer=["Capital Expenditure for New Manufacturing Facility", "Working Capital Requirements", "General Corporate Purposes"]
            )
            db.add(offer)

        # Seed Directors if not present
        existing_directors = db.query(DirectorKMP).filter(DirectorKMP.company_id == company.id).count()
        if existing_directors == 0:
            directors = [
                DirectorKMP(company_id=company.id, name="Vedant Karne", din="01234567", designation="Managing Director", pending_litigation=False),
                DirectorKMP(company_id=company.id, name="Shruti Joshi", din="07654321", designation="Whole-time Director", pending_litigation=False)
            ]
            db.add_all(directors)

        db.commit()
    except Exception as e:
        db.rollback()
        import logging
        logging.getLogger(__name__).warning(f"Failed to seed demo user: {e}")
    finally:
        db.close()

def init_db():
    """Initializes the database by creating all tables, applying migrations, and seeding default demo user."""
    Base.metadata.create_all(bind=engine)
    run_migrations()
    seed_demo_user()

def get_db():
    """Dependency to get the database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
