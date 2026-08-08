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

        # Seed a merchant banker demo login (banker@nirmaan.ai / banker123) on
        # the SAME company, so the banker reviews the same DRHP the founder
        # demo prepares. Nothing in the frontend enforces role-based access
        # yet beyond gating the Document Workspace's editability — see
        # App.jsx's /workspace route.
        banker_email = "banker@nirmaan.ai"
        banker_pwd = "banker123"
        banker_hashed_pwd = bcrypt.hashpw(banker_pwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        banker_user = db.query(CompanyUser).filter(CompanyUser.email == banker_email).first()
        if not banker_user:
            banker_user = CompanyUser(
                company_id=company.id,
                email=banker_email,
                hashed_password=banker_hashed_pwd,
                role="merchant_banker"
            )
            db.add(banker_user)
            db.commit()
        else:
            banker_user.hashed_password = banker_hashed_pwd
            banker_user.company_id = company.id
            banker_user.role = "merchant_banker"
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

        # Seed drafted DRHP sections if not present, so the Document Workspace
        # shows a populated document instead of 26 empty stubs.
        #
        # IMPORTANT — this document text is the reference DRHP excerpt supplied
        # for the demo (Nirmaan_Technologies.docx), reproduced verbatim, not
        # paraphrased. That source describes a different fictional entity
        # (RegTech/AI SaaS, CIN U72900PN2019PTC184627, promoters Aarav Sharma
        # & Kavya Iyer) than the one actually seeded above (Nirmaan
        # Technologies Ltd, CIN U72200MH2021PTC123456, Vedant Karne & Shruti
        # Joshi, a manufacturing capex offer) — by explicit request, this
        # document is shown as-is rather than adapted to match. Sections with
        # no source excerpt are still written in that same source company's
        # voice for internal consistency within the document itself. This
        # means the Workspace document and the Dashboard/Eligibility numbers
        # (computed live from the real seeded financials above) will not
        # reconcile with each other — known, and left as a deliberate
        # trade-off rather than silently "fixed" in one direction.
        existing_sections = db.query(GeneratedSection).filter(GeneratedSection.company_id == company.id).count()
        if existing_sections == 0:
            APPROVED = "intermediary_certified"
            REVIEWED = "promoter_reviewed"
            DRAFT = "draft"

            section_seed = [
                ("Cover Page & General Information", APPROVED, True, 97, [], """# NIRMAAN TECHNOLOGIES LIMITED

*(formerly Nirmaan Technologies Private Limited, prior to its conversion into a public limited company with effect from February 2, 2027)*

**Corporate Identity Number:** U72900PN2019PTC184627 (post-conversion CIN: U72900PN2019PLC184627)

Our Company was incorporated as "Nirmaan Technologies Private Limited" on August 22, 2019 under the Companies Act, 2013, and was converted into a public limited company, with its name changed to "Nirmaan Technologies Limited", with effect from February 2, 2027.

**Registered and Corporate Office:** 4th Floor, Cerebrum IT Park, Kalyani Nagar, Pune, Maharashtra – 411006
**Contact Person:** Priyanka Sinha, Company Secretary & Compliance Officer
**Telephone:** +91 20 6712 3400 · **E-mail:** priyanka@nirmaan.tech
**Website:** www.nirmaan.tech
**Promoters:** Aarav Sharma and Kavya Iyer

## The Offer

Initial Public Offering of 20,00,000 Equity Shares of face value ₹10 each ("Equity Shares") of Nirmaan Technologies Limited for cash, aggregating up to ₹38.00 crore (₹380 million), at a price band of ₹181 to ₹190 per Equity Share, comprising a Fresh Issue of 15,79,000 Equity Shares aggregating up to ₹300.01 million by our Company and an Offer for Sale of 4,21,000 Equity Shares aggregating up to ₹79.99 million by a seed investor selling shareholder.

| Type | Fresh Issue | Offer for Sale | Total Offer Size | Face Value |
|---|---|---|---|---|
| Fresh Issue and Offer for Sale | 15,79,000 Equity Shares (up to ₹300.01 million) | 4,21,000 Equity Shares (up to ₹79.99 million) | 20,00,000 Equity Shares (up to ₹38.00 crore) | ₹10 each |

Proposed to be listed on **NSE Emerge**, the SME platform of the National Stock Exchange of India Limited. The Offer is proposed pursuant to Regulation 229(2) of the SEBI ICDR Regulations, 2018 (SME segment), as the Company does not meet the profitability track-record criteria under Regulation 228 in all of the last three financial years.

## Risks in Relation to the First Offer

The face value of the Equity Shares is ₹10 per Equity Share. This being the first public offer of the Equity Shares of our Company, there has been no formal market for the Equity Shares of our Company. The Offer Price / Price Band, as applicable, will be determined by our Company in consultation with the Book Running Lead Manager(s) on the basis of an assessment of market demand for the Equity Shares, as further described under the section "Basis for Offer Price". No assurance can be given regarding an active or sustained trading in the Equity Shares of our Company or regarding the price at which the Equity Shares will be traded after listing.

## General Risk

Investments in equity and equity-related securities involve a degree of risk and investors should not invest any funds in the Offer unless they can afford to take the risk of losing their entire investment. Investors are advised to read the risk factors carefully before taking an investment decision in the Offer. For taking an investment decision, investors must rely on their own examination of our Company and the Offer, including the risks involved. The Equity Shares offered in the Offer have not been recommended or approved by the Securities and Exchange Board of India ("SEBI"), nor does SEBI guarantee the accuracy or adequacy of the contents of this Prospectus. Specific attention of investors is invited to the section "Risk Factors".

## Issuer's Absolute Responsibility

Our Company, having made all reasonable inquiries, accepts responsibility for and confirms that this Prospectus contains all information with regard to our Company and the Offer, which is material in the context of the Offer, that the information contained in this Prospectus is true and correct in all material respects and is not misleading in any material respect, that the opinions and intentions expressed herein are honestly held and that there are no other facts, the omission of which makes this Prospectus as a whole or any such information or the expression of any such opinions or intentions misleading in any material respect.

## Listing

The Equity Shares offered through this Prospectus are proposed to be listed on NSE Emerge, the SME platform of the National Stock Exchange of India Limited ("NSE", the "Designated Stock Exchange").

## Book Running Lead Manager

Quotient Capital Advisors LLP — Contact: Neel Kapadia · Tel: +91 22 6772 5500 · E-mail: neel.kapadia@quotientcapital.in

## Registrar to the Offer

Meridian Registry Services Private Limited — Contact: Suresh Rane · Tel: +91 22 4912 6600 · E-mail: ipo.nirmaan@meridianregistry.com

## Bid/Offer Programme

Anchor Investor Bidding Date: March 24, 2027 · Bid/Offer Opened: March 25, 2027 · Bid/Offer Closed: March 27, 2027"""),

                ("Risk Factors", APPROVED, True, 86, [], """Our business is substantially dependent on the continued services of our Promoters, particularly our Whole-time Director and Chief Technology Officer, who is primarily responsible for the architecture of our proprietary AI models. The loss of key management or technical personnel could adversely affect our ability to develop and maintain our platform. Additionally, our top 5 enterprise customers collectively accounted for approximately 47% of our Annual Recurring Revenue in Fiscal 2024, and any loss of these customers could materially affect our revenues."""),

                ("Introduction", APPROVED, True, 94, [], """## Summary of Our Company

We are a Pune-headquartered information technology company operating in the RegTech / AI SaaS space, offering a cloud-based platform used by SME issuers, merchant bankers and compliance teams to prepare, validate and manage SEBI-compliant initial public offering disclosure documents. Our platform performs automated drafting, evidence mapping and provides regulatory intelligence to its users.

Our Company was incorporated on August 22, 2019 and our registered office is situated at 4th Floor, Cerebrum IT Park, Kalyani Nagar, Pune, Maharashtra – 411006. As of the date of this Prospectus, our Company has no subsidiaries.

Our platform is used entirely on a business-to-business (B2B) basis. We derive our revenue under a subscription (Software-as-a-Service) model comprising tiered annual licenses together with one-time implementation and onboarding fees. Approximately 6% of our revenue is derived from exports."""),

                ("General Information", APPROVED, True, 95, [], """Our Company's registered office is situated at 4th Floor, Cerebrum IT Park, Kalyani Nagar, Pune, Maharashtra – 411006. Our Company was incorporated under the Companies Act, 2013 with Corporate Identity Number U72900PN2019PTC184627, and the Equity Shares are proposed to be listed on NSE Emerge. Quotient Capital Advisors LLP has been appointed as the Book Running Lead Manager, and Meridian Registry Services Private Limited as Registrar to the Offer. B P S & Associates, Chartered Accountants, are the statutory auditors of our Company."""),

                ("Capital Structure", DRAFT, False, 81, [], """Pursuant to conversion of all outstanding Series A Compulsorily Convertible Preference Shares into Equity Shares with effect from March 2026, the issued, subscribed and paid-up equity share capital of our Company stands at ₹4,12,00,000 divided into 41,20,000 Equity Shares of face value ₹10 each. Our Company has reserved 8.2% of the fully diluted share capital under the Nirmaan Employee Stock Option Scheme, 2021."""),

                ("Objects of the Offer", DRAFT, False, 91, [], """## Objects of the Issue

The Net Proceeds of the Offer are proposed to be utilised as follows:

| Object | % of Net Proceeds |
|---|---|
| Product research & development and AI infrastructure | 40% |
| Sales and marketing expansion | 25% |
| Cloud infrastructure and security certification | 15% |
| General corporate purposes | 20% |

Our strategy, as reflected in this proposed utilisation, is to: (i) invest in product research and development and AI infrastructure; (ii) expand our sales and marketing efforts; (iii) invest in cloud infrastructure and security certifications; and (iv) apply funds towards general corporate purposes."""),

                ("Statement of Tax Benefits", APPROVED, True, 90, [], """As certified by B P S & Associates, Chartered Accountants (statutory auditors of the Company), the statement of possible tax benefits available to the Company and its shareholders under applicable tax laws is annexed to this Prospectus. Investors are advised to consult their own tax advisors regarding the tax consequences of subscribing to or holding the Equity Shares, in view of the fact that certain benefits are dependent on fulfilling conditions prescribed under the relevant tax laws."""),

                ("About the Company", APPROVED, True, 94, [], """Nirmaan Technologies Limited operates a cloud-based AI SaaS platform used by SME issuers, merchant bankers, and compliance teams to prepare, validate, and manage SEBI-compliant IPO disclosure documents through automated drafting, evidence mapping, and regulatory intelligence. Our Company is founder-led and was venture-backed prior to this Offer, having raised a seed round of ₹6.5 crore in 2020 and a Series A round of ₹22 crore in 2022 from two institutional investors, with the Series A preference shares fully converted to equity ahead of this Offer.

We operate a single development and operations centre in Pune, with cloud infrastructure hosted on Amazon Web Services (AWS) in the Mumbai region (ap-south-1)."""),

                ("Industry Overview", APPROVED, True, 89, [], """The RegTech and compliance automation software market in India remains at a nascent stage of adoption relative to global markets, with increasing regulatory complexity across capital markets creating structural tailwinds for AI-assisted compliance platforms."""),

                ("Our Business", APPROVED, True, 92, [], """## Overview

Our platform helps SME issuers, merchant bankers and compliance teams prepare, validate and manage SEBI-compliant IPO disclosure documents, through three principal capabilities: automated drafting, evidence mapping, and regulatory intelligence. As of the periods covered in our financial information, we had 34 active enterprise customers and a net revenue retention rate of 118%.

## Operations and Infrastructure

We operate a single development and operations centre located in Pune, Maharashtra. Our cloud infrastructure is hosted on Amazon Web Services (AWS) in the Mumbai region (ap-south-1). Our platform is supported by a source code escrow arrangement and is certified under ISO/IEC 27001:2022 for information security management. We process and store customer data within India and are compliant with the Digital Personal Data Protection Act, 2023 ("DPDP Act"). We conduct annual third-party penetration testing of our systems.

## Intellectual Property

We hold three registered trademarks (the "Nirmaan" wordmark and logo, "AIKG" and "EDDI") and have one patent application pending examination, in relation to an evidence-mapping method for AI-generated regulatory disclosures. This patent application has not been granted as on the date of this Prospectus and is disclosed on an "application pending" basis only. Our source code is proprietary to our Company.

## Competition

Our competitors include the Diligent Compliance Suite (a global compliance software provider), in-house solutions developed by large merchant banking firms, and traditional legal and compliance outsourcing firms.

## Customer Concentration

Our top five enterprise customers, being merchant banking firms, together accounted for approximately 47% of our Annual Recurring Revenue ("ARR"). Any loss of one or more of these customers could have a material adverse effect on our business and results of operations.

## Our Competitive Strengths

Based on the information available, our Company's competitive strengths include: (i) a subscription-based SaaS revenue model with a net revenue retention rate of 118%, indicating expansion within our existing customer base; (ii) proprietary, patent-pending evidence-mapping technology supporting AI-generated regulatory disclosures; (iii) information security credentials, including ISO/IEC 27001:2022 certification and compliance with the DPDP Act, 2023; and (iv) an experienced founding and management team, including an Independent Director who is a former SEBI official.

## Our Strategy

Our strategy, as reflected in our proposed use of the Net Proceeds of the Offer, is to: (i) invest in product research and development and AI infrastructure; (ii) expand our sales and marketing efforts; (iii) invest in cloud infrastructure and security certifications; and (iv) apply funds towards general corporate purposes."""),

                ("Key Industry Regulations", REVIEWED, False, 85,
                 ["Specific clause citations pending compliance-team review"],
                 """As a provider of software used in connection with SEBI-regulated capital markets processes, our operations are indirectly affected by the SEBI ICDR Regulations, 2018 and related SME listing norms that our platform is designed to help issuers comply with. Our Company itself is subject to applicable information technology, data protection, and consumer protection laws, including the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023, together with regulations applicable to Indian companies generally, including the Companies Act, 2013."""),

                ("History and Corporate Structure", DRAFT, False, 88, [], """Our Company was originally incorporated as "Nirmaan Technologies Private Limited" on August 22, 2019 under the Companies Act, 2013, and was converted into a public limited company with effect from February 2, 2027, upon which its name was changed to "Nirmaan Technologies Limited". Our Company has no subsidiaries. Pursuant to conversion of all outstanding Series A Compulsorily Convertible Preference Shares into Equity Shares with effect from March 2026, our issued, subscribed and paid-up equity share capital stands at ₹4,12,00,000 divided into 41,20,000 Equity Shares of face value ₹10 each."""),

                ("Management & Board of Directors", DRAFT, False, 89, [], """Our Board comprises the following directors:

| Name | Designation |
|---|---|
| Aarav Sharma | Managing Director & CEO |
| Kavya Iyer | Whole-time Director & CTO |
| Ramesh Chandra | Independent Director (former SEBI official) |
| Nandini Kapoor | Independent Director |
| Vikram Oberoi | Nominee Director (Institutional Investor) |

Our management believes that the composition of the Board, including the presence of an Independent Director with prior regulatory experience at SEBI, strengthens our corporate governance practices ahead of this Offer."""),

                ("Key Managerial Personnel (KMP)", DRAFT, False, 86, [], """Our key managerial personnel, in addition to our Promoters, are:

| Name | Role |
|---|---|
| Priyanka Sinha | Company Secretary & Compliance Officer |
| Rahul Deshmukh | Chief Financial Officer |
| Sneha Patwardhan | VP Engineering |"""),

                ("Related Party Transactions", REVIEWED, False, 78,
                 ["Disclosure language for office sub-lease and ESOP Trust pending legal review"],
                 """Our Company's office premises are sub-leased from Cerebrum Business Park Private Limited, which is not related to our Promoters. Our employee stock option pool is administered through the Nirmaan Employee Welfare Trust. Save as disclosed above, our Company has not entered into any related party transactions that are material in the context of this Offer."""),

                ("Dividend Policy", APPROVED, True, 93, [], """Our Company has not declared or paid any dividends on its Equity Shares in the last three fiscal years. Our Company intends to retain future earnings, if any, to finance the expansion of its business, and does not anticipate declaring dividends in the near term. Any future determination as to dividends will depend on factors considered relevant by our Board, including our results of operations, cash flows, capital requirements, and applicable legal restrictions."""),

                ("Financial Statements (3 Years)", DRAFT, False, 70,
                 ["ARR (SaaS metrics MIS) does not reconcile with revenue recognised in the audited FY24 P&L — deferred-revenue treatment pending resolution"],
                 """## Key Financial Information

| Particulars (₹ in crore) | FY22 | FY23 | FY24 |
|---|---|---|---|
| Revenue | 4.6 | 9.8 | 17.4 |
| Net Profit / (Loss) | (2.1) | (0.6) | 1.8 |

| Net Worth (₹ Cr) | EBITDA (₹ Cr) | ARR (₹ Cr) | ARR Growth (YoY) |
|---|---|---|---|
| 14.2 | 2.9 | 19.6 | 78% |

Net revenue retention was 118% and our Company had 34 active customers, in each case as of the relevant measurement date reflected in our records. Our Company has no outstanding borrowings. Contingent liabilities amounted to ₹18 lakh, comprising a performance bank guarantee issued to one enterprise client. Our financial statements for Fiscal 2022, Fiscal 2023 and Fiscal 2024 were audited by B P S & Associates, Chartered Accountants."""),

                ("Management Discussion & Analysis", DRAFT, False, 74, [], """Our Company's revenue grew from ₹4.6 crore in Fiscal 2022 to ₹17.4 crore in Fiscal 2024, and our Company recorded a net profit of ₹1.8 crore in Fiscal 2024 as compared to net losses in Fiscal 2022 and Fiscal 2023. Our management attributes this trend to growth in our subscription customer base and improved net revenue retention. Our Company's business is significantly dependent on the continued association of our co-founders, particularly our Whole-time Director and Chief Technology Officer, who is primarily responsible for our AI/ML architecture; the loss of either founder could adversely affect our business."""),

                ("Other Regulatory & Statutory Disclosures", REVIEWED, False, 71, [], """Our Company holds a valid GST registration, Startup India (DPIIT) recognition certificate, and ISO/IEC 27001:2022 certification for information security management. Our Company has one patent application pending examination in relation to an evidence-mapping method for AI-generated regulatory disclosures; this application has not been granted as on the date of this Prospectus and is disclosed strictly on an "application pending" basis. Our Company confirms that there is no winding-up petition or reference to the erstwhile Board for Industrial and Financial Reconstruction (BIFR) pending against it."""),

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
