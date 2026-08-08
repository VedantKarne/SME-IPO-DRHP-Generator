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
        from src.extraction.schema import Company, CompanyUser, FinancialStatement, OfferDetails, DirectorKMP, GeneratedSection

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

        # Seed drafted DRHP sections if not present, so the Document Workspace,
        # Dashboard and Eligibility screens show a populated document instead of
        # 26 empty stubs. Grounded in the financials/offer/directors seeded
        # above (not an unrelated fictional company) — Eligibility, readiness
        # and consistency are computed live from that same real data, not
        # seeded separately here.
        existing_sections = db.query(GeneratedSection).filter(GeneratedSection.company_id == company.id).count()
        if existing_sections == 0:
            APPROVED = "intermediary_certified"
            REVIEWED = "promoter_reviewed"
            DRAFT = "draft"

            section_seed = [
                ("Cover Page & General Information", APPROVED, True, 96, [], """# NIRMAAN TECHNOLOGIES LTD

Corporate Identity Number: U72200MH2021PTC123456

**Registered Office:** Plot 42, Tech Park, Pune, Maharashtra 411057

Our Company was incorporated under the Companies Act, 2013 and is registered with the Registrar of Companies, Maharashtra.

## The Offer

Initial Public Offering of 50,00,000 Equity Shares of face value ₹10 each, at a price of ₹100 per Equity Share, aggregating up to ₹50.00 crore.

| Particulars | Details |
|---|---|
| Issue Type | Fresh Issue |
| Equity Shares Offered | 50,00,000 |
| Price per Share | ₹100 |
| Total Issue Size | ₹50.00 crore |

The Equity Shares are proposed to be listed on the SME platform of a recognised stock exchange, pursuant to Chapter IX of the SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018.

## Promoters

Vedant Karne, Managing Director, and Shruti Joshi, Whole-time Director."""),

                ("Risk Factors", APPROVED, True, 85, [], """Our business is significantly dependent on the continued association of our Managing Director and Whole-time Director, who together oversee our operations and manufacturing expansion plans. The loss of either could adversely affect our business.

A material portion of the Net Proceeds of this Offer is proposed to be applied towards capital expenditure for a new manufacturing facility. Any delay in commissioning this facility, or a shortfall in the demand we currently anticipate, could adversely affect the return on this investment and our future results of operations.

Our Company's board currently comprises two directors, both of whom are Promoters. We have not yet inducted an Independent Director; this is required prior to listing under applicable SME board composition norms and is currently in progress — see "Corporate Governance"."""),

                ("Introduction", APPROVED, True, 93, [], """## Summary of Our Company

Nirmaan Technologies Ltd is a Pune-headquartered manufacturing company registered under the Companies Act, 2013, with its registered office at Plot 42, Tech Park, Pune, Maharashtra. Our Company designs and manufactures precision industrial components for customers in the engineering and light-manufacturing sector.

Our revenue has grown from ₹12.00 crore in Fiscal 2022 to ₹23.00 crore in Fiscal 2024, with EBITDA increasing from ₹1.80 crore to ₹4.10 crore over the same period, reflecting consistent operating profitability across all three years under review."""),

                ("General Information", APPROVED, True, 94, [], """Our Company's registered office is situated at Plot 42, Tech Park, Pune, Maharashtra 411057, with Corporate Identity Number U72200MH2021PTC123456. The Offer comprises a fresh issue of 50,00,000 Equity Shares of face value ₹10 each at a price of ₹100 per Equity Share, aggregating up to ₹50.00 crore, proposed to be listed on the SME platform of a recognised stock exchange."""),

                ("Capital Structure", DRAFT, False, 78, [], """As on the date of this Prospectus, the paid-up equity share capital of our Company is ₹3.00 crore, unchanged over Fiscal 2022, 2023 and 2024. Pursuant to the Offer, our Company proposes to issue 50,00,000 new Equity Shares of face value ₹10 each, which will increase the post-Offer paid-up capital accordingly.

*Draft — pre- and post-Offer shareholding pattern tables pending finalisation of the Basis of Allotment.*"""),

                ("Objects of the Offer", DRAFT, False, 82, [], """## Objects of the Issue

The Net Proceeds of the Offer, aggregating up to ₹50.00 crore, are proposed to be utilised towards:

1. Capital expenditure for a new manufacturing facility
2. Working capital requirements
3. General corporate purposes

A detailed schedule of proposed deployment and the specific percentage allocation across these objects is being finalised in consultation with the proposed Book Running Lead Manager."""),

                ("Statement of Tax Benefits", APPROVED, True, 88, [], """A statement of possible tax benefits available to our Company and to its shareholders under applicable direct and indirect tax laws, as certified by our statutory auditors, will be annexed to this Prospectus. Investors are advised to consult their own tax advisors regarding the tax consequences of subscribing to or holding the Equity Shares, since certain benefits are dependent on fulfilling conditions prescribed under the relevant tax laws."""),

                ("About the Company", APPROVED, True, 92, [], """Nirmaan Technologies Ltd is engaged in the manufacture of precision industrial components, operating from its facility in Pune, Maharashtra. Our Company was incorporated under the Companies Act, 2013 and is led by our Promoters, Vedant Karne (Managing Director) and Shruti Joshi (Whole-time Director).

Our paid-up equity share capital has remained at ₹3.00 crore through Fiscal 2022, 2023 and 2024, funded through internal accruals, while our net worth has grown from ₹4.50 crore to ₹9.15 crore over the same period."""),

                ("Industry Overview", APPROVED, True, 86, [], """Our Company operates in the precision manufacturing and industrial components segment, which supplies engineering-grade components to manufacturers across the automotive, industrial equipment and allied sectors. Demand in this segment is closely linked to broader industrial capital expenditure cycles and the continuing push towards domestic component sourcing."""),

                ("Our Business", APPROVED, True, 90, [], """## Overview

We manufacture precision industrial components at our facility in Pune, Maharashtra, serving customers in the engineering and industrial equipment sector. Our revenue grew from ₹12.00 crore in Fiscal 2022 to ₹23.00 crore in Fiscal 2024, a compound growth of approximately 38% per annum, with EBITDA margins improving from 15.0% to 17.8% over the same period.

## Manufacturing and Expansion

Our existing facility supports our current scale of operations. A material portion of the Net Proceeds of this Offer is proposed to be deployed towards capital expenditure for a new manufacturing facility to support continued growth in order volumes.

## Financial Track Record

| Particulars (₹ in crore) | FY22 | FY23 | FY24 |
|---|---|---|---|
| Revenue | 12.00 | 16.50 | 23.00 |
| EBITDA | 1.80 | 2.60 | 4.10 |
| PAT | 1.20 | 1.75 | 2.90 |
| Net Worth | 4.50 | 6.25 | 9.15 |

Our Company has recorded positive profit after tax in each of the last three financial years."""),

                ("Key Industry Regulations", REVIEWED, False, 70,
                 ["Specific factory licence numbers pending confirmation from company secretary"],
                 """Our operations are subject to applicable factory licensing, environmental consent, labour, and industrial safety regulations applicable to manufacturing units in Maharashtra, in addition to general corporate law requirements under the Companies Act, 2013.

*Draft — specific licences and registrations held by our Company are being compiled for this section.*"""),

                ("History and Corporate Structure", DRAFT, False, 80, [], """Our Company was incorporated under the Companies Act, 2013 with Corporate Identity Number U72200MH2021PTC123456. Our Company has no subsidiaries as on the date of this Prospectus. Our paid-up equity share capital has remained stable at ₹3.00 crore across the three fiscal years under review."""),

                ("Management & Board of Directors", DRAFT, False, 75, [], """Our Board currently comprises the following directors:

| Name | DIN | Designation |
|---|---|---|
| Vedant Karne | 01234567 | Managing Director |
| Shruti Joshi | 07654321 | Whole-time Director |

Neither director is party to any pending litigation. Our Company is in the process of identifying and appointing an Independent Director in accordance with applicable SME board composition norms ahead of listing — see "Corporate Governance"."""),

                ("Key Managerial Personnel (KMP)", DRAFT, False, 68, [], """Our Company's key managerial functions are currently discharged by our two Whole-time/Managing Directors, Vedant Karne and Shruti Joshi. Our Company is in the process of formalising the appointment of a Company Secretary and Chief Financial Officer as key managerial personnel ahead of listing, as required under the Companies Act, 2013."""),

                ("Related Party Transactions", REVIEWED, False, 65,
                 ["Awaiting auditor confirmation on related-party transaction completeness"],
                 """As on the date of this Prospectus, our Company has not identified any related party transactions that are material in the context of the Offer, other than remuneration paid to our Promoter-Directors in the ordinary course of business.

*Draft — final related-party disclosure schedule pending sign-off from statutory auditors.*"""),

                ("Dividend Policy", APPROVED, True, 91, [], """Our Company has not declared or paid any dividends on its Equity Shares in Fiscal 2022, 2023 or 2024. Our Company has retained its profits to fund working capital and capacity expansion, and does not have a formal dividend policy as on the date of this Prospectus. Any future dividend distribution will be at the discretion of our Board, having regard to our results of operations, cash flows, capital expenditure plans, and applicable legal restrictions."""),

                ("Financial Statements (3 Years)", DRAFT, False, 74, [], """## Key Financial Information

| Particulars (₹ in crore) | FY22 | FY23 | FY24 |
|---|---|---|---|
| Revenue | 12.00 | 16.50 | 23.00 |
| EBITDA | 1.80 | 2.60 | 4.10 |
| Profit After Tax | 1.20 | 1.75 | 2.90 |
| Net Worth | 4.50 | 6.25 | 9.15 |
| Paid-up Equity Capital | 3.00 | 3.00 | 3.00 |

Our Company has recorded positive PAT in each of the last three fiscal years, with EBITDA at or above ₹1 crore in all three years.

*Draft — full audited financial statements and auditor's report to be annexed once received from our statutory auditors.*"""),

                ("Management Discussion & Analysis", DRAFT, False, 76, [], """Our Company's revenue grew from ₹12.00 crore in Fiscal 2022 to ₹23.00 crore in Fiscal 2024, at a compound annual growth rate of approximately 38%. EBITDA margin improved from 15.0% in Fiscal 2022 to 17.8% in Fiscal 2024, and Profit After Tax more than doubled over the same period, from ₹1.20 crore to ₹2.90 crore. Management attributes this growth to increased order volumes from existing customers and improved capacity utilisation at our existing facility."""),

                ("Other Regulatory & Statutory Disclosures", REVIEWED, False, 68,
                 ["Government approvals list pending compilation"],
                 """Our Company confirms that there is no winding-up petition, and no reference to the erstwhile Board for Industrial and Financial Reconstruction (BIFR), pending against it as on the date of this Prospectus.

*Draft — remaining statutory disclosures (material government approvals, licences held) pending compilation.*"""),

                ("Outstanding Litigation and Material Developments", APPROVED, True, 89, [], """As on the date of this Prospectus, there is no material outstanding litigation involving our Company, our Promoters, or our Directors, and no regulatory or tax proceedings that would have a material adverse effect on our Company if determined adversely."""),
            ]
            # "Basis of Issue Price", "Our Promoters & Promoter Group", "Corporate
            # Governance", "Terms of the Issue", "Material Contracts & Documents"
            # and "Declaration & Undertakings" are intentionally left unseeded —
            # get_company_sections() already renders any section with no row as
            # a clean "pending" stub, matching a company still mid-preparation.

            sections = [
                GeneratedSection(
                    company_id=company.id,
                    section_name=name,
                    draft_text=text,
                    completeness_score=score / 100,  # stored as a 0-1 fraction — see compute_readiness()
                    flagged_gaps=gaps,
                    status=status,
                    is_locked=locked,
                )
                for name, status, locked, score, gaps, text in section_seed
            ]
            db.add_all(sections)

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
