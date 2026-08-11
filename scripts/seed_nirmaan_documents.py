"""
scripts/seed_nirmaan_documents.py

Seeds Nirmaan Technologies Ltd (1460c1dc-...) with demo documents:
  1. Creates realistic text content for each DRHP document type
  2. Indexes them into ChromaDB 'client_documents' collection under the
     correct company_id so the LLM generation pipeline uses Nirmaan context
  3. Creates UploadedDocument DB records so the UI shows the files

Run:
    python scripts/seed_nirmaan_documents.py
"""

import os
import sys
import uuid
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from src.extraction.db_session import SessionLocal
from src.extraction.schema import UploadedDocument, Company

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

NIRMAAN_ID = "1460c1dc-dc40-4f35-825c-2dc163f38bd4"

# ─── Rich demo document content for Nirmaan Technologies Ltd ──────────────────

DOCUMENTS = [
    {
        "filename": "Nirmaan_Audited_Financials_3Y.pdf",
        "doc_type": "0",
        "section": "Financial Statements (3 Years)",
        "content": """
NIRMAAN TECHNOLOGIES LIMITED
Audited Financial Statements — FY 2022, FY 2023, FY 2024

INDEPENDENT AUDITOR'S REPORT

To the Members of Nirmaan Technologies Limited
CIN: U72200MH2021PTC123456
Registered Office: Plot 42, Tech Park, Pune, Maharashtra 411057

We have audited the accompanying financial statements of NIRMAAN TECHNOLOGIES LIMITED ("the Company"), which comprise the Balance Sheet as at March 31, 2024, and the Statement of Profit and Loss, the Statement of Changes in Equity and the Statement of Cash Flows for the year then ended, and notes to the financial statements including a summary of significant accounting policies.

BALANCE SHEET (in ₹ Lakhs)

Particulars                           FY 2024      FY 2023      FY 2022
─────────────────────────────────────────────────────────────────────────
EQUITY AND LIABILITIES

Shareholders' Funds:
  Share Capital                         300.00       300.00       300.00
  Reserves & Surplus                    450.00       380.00       150.00
  Total Equity                          750.00       680.00       450.00

Non-Current Liabilities:
  Long-term Borrowings                  120.00       140.00       180.00
  Deferred Tax Liabilities               18.00        15.00        12.00

Current Liabilities:
  Trade Payables                        210.00       185.00       160.00
  Short-term Borrowings                  90.00        80.00        70.00
  Other Current Liabilities              45.00        38.00        32.00
  Total Liabilities                     483.00       458.00       454.00

TOTAL EQUITY AND LIABILITIES         1,233.00     1,138.00       904.00

ASSETS

Non-Current Assets:
  Property, Plant & Equipment           380.00       360.00       340.00
  Intangible Assets                      85.00        75.00        60.00
  Capital Work-in-Progress               30.00        25.00        20.00
  Long-term Investments                  50.00        45.00        40.00

Current Assets:
  Inventories                          188.00       165.00       145.00
  Trade Receivables                    280.00       248.00       198.00
  Cash & Cash Equivalents               90.00        80.00        60.00
  Short-term Loans & Advances          130.00       140.00       141.00

TOTAL ASSETS                         1,233.00     1,138.00       904.00

STATEMENT OF PROFIT AND LOSS (in ₹ Lakhs)

Particulars                           FY 2024      FY 2023      FY 2022
─────────────────────────────────────────────────────────────────────────
Revenue from Operations               1,680.00     1,450.00     1,200.00
Other Income                             42.00        35.00        28.00
TOTAL INCOME                          1,722.00     1,485.00     1,228.00

EXPENSES:
  Cost of Materials Consumed           840.00       720.00       600.00
  Employee Benefit Expense             210.00       185.00       155.00
  Finance Costs                         28.00        32.00        38.00
  Depreciation & Amortisation           55.00        50.00        45.00
  Other Expenses                       280.00       248.00       202.00
TOTAL EXPENSES                        1,413.00     1,235.00     1,040.00

PROFIT BEFORE TAX                      309.00       250.00       188.00
Income Tax (Current + Deferred)         78.00        63.00        68.00
PROFIT AFTER TAX                       231.00       187.00       120.00

EPS (Basic)                             7.70         6.23         4.00
EPS (Diluted)                           7.65         6.20         3.98

KEY FINANCIAL RATIOS:
  EBITDA Margin:                        23.1%        21.4%        19.2%
  PAT Margin:                           13.8%        12.9%        10.0%
  Return on Equity (RoE):              30.8%        27.5%        26.7%
  Return on Capital Employed (RoCE):   28.4%        25.8%        23.2%
  Debt-to-Equity Ratio:                 0.28         0.32         0.56
  Current Ratio:                        2.02         2.07         1.92
  
CASH FLOW STATEMENT (FY 2024, in ₹ Lakhs):
  Net Cash from Operating Activities:  285.00
  Net Cash from Investing Activities: (120.00)
  Net Cash from Financing Activities:  (85.00)
  Net Increase in Cash:                 80.00

Signed for and on behalf of:
Vedant Karne, Managing Director (DIN: 01234567)
Priya Sharma, Chief Financial Officer
S.R. Mehra & Associates, Chartered Accountants (Firm Reg. No. 105421W)
""",
    },
    {
        "filename": "Nirmaan_Board_Resolution_IPO.pdf",
        "doc_type": "1",
        "section": "General Information",
        "content": """
NIRMAAN TECHNOLOGIES LIMITED
CIN: U72200MH2021PTC123456

CERTIFIED TRUE COPY OF RESOLUTION PASSED AT THE MEETING OF THE BOARD OF DIRECTORS

Date: January 15, 2025
Venue: Registered Office — Plot 42, Tech Park, Pune, Maharashtra 411057
Time: 10:00 AM IST

Directors Present:
1. Vedant Karne — Managing Director (DIN: 01234567)
2. Priya Sharma — Whole-time Director (DIN: 02345678)
3. Rajesh Patel — Independent Director (DIN: 03456789)
4. Sunita Agarwal — Independent Director (DIN: 04567890)
5. Amit Joshi — Non-Executive Director (DIN: 05678901)

The Chairperson noted that a quorum is present.

RESOLVED THAT pursuant to the provisions of the Companies Act, 2013, SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018 ("SEBI ICDR Regulations"), and other applicable laws and regulations, and subject to the approval of the shareholders and regulatory authorities, the Company proposes to undertake an Initial Public Offering (IPO) on the NSE SME Emerge Platform.

RESOLVED FURTHER THAT the proposed IPO shall comprise:
- Fresh Issue of equity shares of ₹10/- face value each for an amount not exceeding ₹25 crores
- An Offer for Sale component if required by SEBI guidelines

RESOLVED FURTHER THAT Quotient Capital Advisors LLP (SEBI Reg. No. MB/INM000012345) be and is hereby appointed as the Lead Manager / Merchant Banker for the proposed IPO.

RESOLVED FURTHER THAT Meridian Registry Services Pvt. Ltd. be appointed as the Registrar and Transfer Agent (RTA) for the proposed IPO.

RESOLVED FURTHER THAT the Objects of the Issue shall include:
1. Capital expenditure for expansion of manufacturing facility at Chakan, Pune (₹8 crores)
2. Working capital requirements (₹12 crores)
3. General corporate purposes (balance amount)

RESOLVED FURTHER THAT Vedant Karne, Managing Director, and Priya Sharma, Whole-time Director, be and are hereby jointly and severally authorised to take all steps necessary to file the Draft Red Herring Prospectus with SEBI.

Certified by:
Ananya Iyer
Company Secretary (M.No. A45678)
""",
    },
    {
        "filename": "Nirmaan_MOA_AOA_Certificate.pdf",
        "doc_type": "9",
        "section": "History and Corporate Structure",
        "content": """
MEMORANDUM OF ASSOCIATION
NIRMAAN TECHNOLOGIES LIMITED
CIN: U72200MH2021PTC123456

CLAUSE I — NAME
The name of the Company is NIRMAAN TECHNOLOGIES LIMITED.

CLAUSE II — REGISTERED OFFICE
The Registered Office of the Company will be situated in the State of Maharashtra.
Address: Plot 42, Tech Park, Nagar Road, Yerwada, Pune – 411006, Maharashtra.

CLAUSE III — OBJECTS OF THE COMPANY
A. MAIN OBJECTS:
1. To carry on the business of manufacturing, designing, developing, importing, exporting, installing, commissioning, maintaining, and servicing of Information Technology hardware, software, embedded systems, IoT devices, sensors, microcontrollers, PCBA assemblies, and all kinds of electronic components.
2. To provide technology solutions, system integration, contract electronics manufacturing services (CEMS), and turnkey electronic products to OEMs, enterprises, and the government sector.
3. To develop and commercialise proprietary technology platforms, software applications, and SaaS products for industrial automation, smart manufacturing, and Industry 4.0 applications.
4. To provide engineering design services, product development, prototyping, testing, calibration, and certification services for electronic and electro-mechanical products.

B. OBJECTS INCIDENTAL TO MAIN OBJECTS:
To carry on business as manufacturers, producers, assemblers, repairers of all kinds of electrical, electronic goods, instruments, apparatus, equipment and appliances.

CAPITAL CLAUSE:
The Authorised Share Capital of the Company is ₹5,00,00,000 (Rupees Five Crores) divided into 50,00,000 Equity Shares of ₹10/- each.

Paid-up Share Capital as on date: ₹3,00,00,000 (Rupees Three Crores) divided into 30,00,000 Equity Shares of ₹10/- each.

CERTIFICATE OF INCORPORATION:
This is to certify that NIRMAAN TECHNOLOGIES LIMITED (CIN: U72200MH2021PTC123456) was incorporated on March 15, 2021 under the Companies Act, 2013.
Issued by: Registrar of Companies, Maharashtra, Pune
Date: March 15, 2021

SHAREHOLDING PATTERN (Pre-IPO):
Name                         Shares       % Holding    Category
─────────────────────────────────────────────────────────────────
Vedant Karne                10,50,000      35.00%      Promoter
Priya Sharma                 7,50,000      25.00%      Promoter
Karne Family Trust           4,50,000      15.00%      Promoter Group
Institutional Investors      4,50,000      15.00%      Public
Angel Investors              3,00,000      10.00%      Public
TOTAL                       30,00,000     100.00%
─────────────────────────────────────────────────────────────────
Promoter Group Total:       22,50,000      75.00%
Public Total:                7,50,000      25.00%
""",
    },
    {
        "filename": "Nirmaan_Business_Overview.pdf",
        "doc_type": "2",
        "section": "Our Business",
        "content": """
NIRMAAN TECHNOLOGIES LIMITED — BUSINESS OVERVIEW

ABOUT THE COMPANY:
Nirmaan Technologies Limited (formerly Nirmaan Electronics Solutions LLP, reconstituted as a private limited company in 2021) is a Pune-headquartered technology company specialising in Contract Electronics Manufacturing Services (CEMS) and Industrial IoT solutions. The Company was founded in 2021 by Vedant Karne and Priya Sharma.

THE PROMOTERS:
1. VEDANT KARNE (Managing Director):
   Age: 34 years | DIN: 01234567 | Qualification: B.Tech (Electronics), IIT Bombay (2012); MBA (Finance), IIM Ahmedabad (2014)
   Experience: 10+ years in electronics manufacturing and technology entrepreneurship. Previously worked at Tata Electronics (2014–2018) as Senior Product Manager and at Honeywell India (2018–2021) as Business Development Manager.
   
2. PRIYA SHARMA (Whole-time Director & CFO):
   Age: 31 years | DIN: 02345678 | Qualification: CA (ICAI, 2015); B.Com, Pune University
   Experience: 9+ years in finance and technology operations. Previously worked at KPMG India (2015–2019) as Senior Audit Manager and at Mahindra Electric (2019–2021) as Head of Finance.

CORE BUSINESS SEGMENTS:

1. CONTRACT ELECTRONICS MANUFACTURING (CEMS):
   - PCBA (Printed Circuit Board Assembly) for OEMs
   - Box-Build Assembly and complete product manufacturing
   - Surface Mount Technology (SMT) lines with IPC Class II/III capability
   - Capacity: 2 SMT lines | Output: ~50,000 PCBA units/month
   - Key clients: Mid-size OEMs in industrial, healthcare, and consumer electronics sectors

2. INDUSTRIAL IoT SOLUTIONS:
   - Design and development of IoT gateways, edge computing devices
   - Smart factory solutions — real-time monitoring, predictive maintenance
   - NirmaaConnect™ Platform: Cloud-based IoT platform for industrial asset monitoring
   - 18 active enterprise clients including Kirloskar Electric, Thermax Ltd.

3. PRODUCT DEVELOPMENT & ENGINEERING SERVICES:
   - Hardware design: Schematic capture, PCB layout, firmware development
   - Prototype development to mass production support
   - Testing, validation, CE/UL/BIS certification support

MANUFACTURING FACILITY:
   Location: Plot C-12, MIDC Chakan Industrial Area, Phase III, Pune – 410501
   Area: 8,500 sq ft (existing) + 4,000 sq ft (proposed expansion via IPO proceeds)
   ISO 9001:2015 certified | MSME registered (Udyam Registration No. MH-20-0095432)
   ESD-safe clean room: 1,500 sq ft
   Current headcount: 127 employees (57 engineers, 48 technicians, 22 support staff)

KEY CUSTOMERS:
- Kirloskar Electric Company Ltd (15% of FY24 revenue)
- Thermax Limited (11% of FY24 revenue)
- Bajaj Electricals Ltd (9% of FY24 revenue)
- 23 other SME/enterprise clients

KEY COMPETITIVE STRENGTHS:
1. Vertically integrated operations from design to manufacturing
2. Proprietary NirmaaConnect™ IoT platform
3. ISO 9001:2015 certified quality management
4. Strong promoter experience across electronics and finance
5. Growing government and defence electronics sector opportunities (Make in India)

GROWTH STRATEGY:
- Expand manufacturing capacity (funded by IPO)
- Increase IoT platform subscribers from 18 to 50+ clients by FY2027
- Enter government/defence electronics sector (approved vendor with Ministry of Defence)
- Expand to Tier-2 city markets (Nashik, Aurangabad)
""",
    },
    {
        "filename": "Nirmaan_GSTIN_PAN_Registrations.pdf",
        "doc_type": "8",
        "section": "Other Regulatory & Statutory Disclosures",
        "content": """
NIRMAAN TECHNOLOGIES LIMITED — STATUTORY REGISTRATIONS

1. COMPANY IDENTIFICATION:
   CIN: U72200MH2021PTC123456
   Company Type: Public Limited Company (converted from Private Limited, January 2025)
   Date of Incorporation: March 15, 2021
   Registrar of Companies: RoC Pune, Maharashtra

2. TAX REGISTRATIONS:
   PAN: AABCN1234F (Issued by Income Tax Department, Government of India)
   TAN: PUNL12345F
   GST Registration:
     GSTIN: 27AABCN1234F1Z9 (State: Maharashtra)
     Registration Date: April 1, 2021
     Registration Type: Regular Taxpayer
   GST Compliance: All GST returns filed on time. No outstanding dues as of date.
   
3. EMPLOYEES AND STATUTORY COMPLIANCES:
   PF Registration No.: MH/PUN/123456 (EPFO)
   ESI Registration No.: 41-17-123456-000-0001
   Professional Tax Registration: 27923456789
   Total Employees: 127 (as of December 31, 2024)
   
4. INDUSTRIAL LICENCES:
   MSME Registration (Udyam): MH-20-0095432
   Category: Micro Enterprise (manufacturing)
   Factory Licence: FL/MH/CHAKAN/2021/4523 (Pune District, Maharashtra)
   Validity: March 31, 2026 (renewal in process)
   
5. ENVIRONMENTAL CLEARANCES:
   Pollution Under Control (PUC) Certificate: Valid till June 30, 2025
   Maharashtra Pollution Control Board (MPCB) Consent to Operate: 
   Order No. MPCB/PUNE/2023/4521 | Valid till March 31, 2026
   Category: Green (no hazardous industrial process)
   
6. QUALITY CERTIFICATIONS:
   ISO 9001:2015 Certificate No.: QMS/2023/IN/45678
   Issued by: Bureau Veritas (India) Pvt. Ltd.
   Valid till: October 2026

7. TRADEMARK:
   "NirmaaConnect" — Trademark Registration No. 4567890
   Class 9 (Electronic Instruments, Apparatus) and Class 42 (Software as a Service)
   Registered: January 2023 | Status: Valid

8. IMPORT-EXPORT LICENCE:
   IEC Code: 0521002345 (issued by DGFT, Government of India)
   Active Status: Yes

9. BANKING RELATIONSHIPS:
   Banker: HDFC Bank Limited (Main) | Account No.: 5020XXXXXX | Branch: Yerawada, Pune
   Working Capital Facility: ₹6 crores CC limit (sanctioned March 2023)
   Term Loan: ₹2.8 crores (outstanding as on Dec 31, 2024)
""",
    },
    {
        "filename": "Nirmaan_Objects_of_the_Issue.pdf",
        "doc_type": "1",
        "section": "Objects of the Offer",
        "content": """
OBJECTS OF THE ISSUE — NIRMAAN TECHNOLOGIES LIMITED

UTILISATION OF IPO PROCEEDS:

The Company proposes to raise approximately ₹25 crores through the Fresh Issue.
The Net Proceeds (after deducting Issue Expenses) will be utilised as follows:

Sr.  Particulars                                      Amount (₹ Lakhs)   % of Net Proceeds
────────────────────────────────────────────────────────────────────────────────────────────
1.   Capital Expenditure for Manufacturing Expansion        800.00            35.6%
     - New SMT line (equipment purchase)                   (480.00)
     - Civil work — additional 4,000 sq ft shed            (180.00)
     - ESD infrastructure, testing equipment               (140.00)
     
2.   Working Capital Requirements                        1,200.00            53.3%
     - Inventory build-up for FY26 growth orders           (700.00)
     - Receivables cycle management (60-day cycle)         (500.00)
     
3.   General Corporate Purposes                            247.00            11.0%
     (including brand building, IT infrastructure, compliance)

TOTAL NET PROCEEDS                                       2,247.00           100.0%

ISSUE EXPENSES (estimated, borne from gross proceeds):
  - Lead Manager fees (Quotient Capital Advisors LLP)       45.00
  - Registrar fees (Meridian Registry Services Pvt. Ltd.)   15.00
  - SEBI filing fees, stock exchange fees, legal fees       35.00
  - Marketing and advertising                               35.00
  - Other miscellaneous issue expenses                      23.00
TOTAL ISSUE EXPENSES (estimated)                           153.00

GROSS PROCEEDS FROM FRESH ISSUE                          2,400.00 (₹24 crores approx.)

NOTES:
1. The quantum of the Fresh Issue and net proceeds are subject to market conditions and SEBI approval.
2. The actual deployment may vary from the stated utilisation if circumstances change.
3. The Company has not entered into any specific contracts for the Capex as of date of filing.
4. Working capital requirements have been assessed by the Lead Manager independently.
5. The Company shall provide regular updates on utilisation of funds through stock exchange filings.

CAPACITY EXPANSION RATIONALE:
Current SMT line capacity: 50,000 PCBA units/month
Post-expansion capacity (new SMT line): 80,000 PCBA units/month (60% increase)
Expected revenue uplift from expansion: ₹380-420 lakhs per annum (at 70% capacity utilisation)

The expansion is supported by:
- Confirmed orders worth ₹480 lakhs from Kirloskar Electric Company for FY26-FY27
- LOI from Thermax Limited for additional ₹250 lakhs of annual business
- Growing demand from automotive electronics OEMs in Pune industrial cluster
""",
    },
    {
        "filename": "Nirmaan_Risk_Factors.pdf",
        "doc_type": "3",
        "section": "Risk Factors",
        "content": """
RISK FACTORS — NIRMAAN TECHNOLOGIES LIMITED

INTERNAL RISKS:

1. CUSTOMER CONCENTRATION RISK
Our top three customers (Kirloskar Electric, Thermax, and Bajaj Electricals) accounted for approximately 35% of our total revenues in FY 2024. Loss of any of these customers could materially and adversely affect our business and financial performance.

2. DEPENDENCE ON PROMOTERS
Our Company is significantly dependent on our Promoters, Mr. Vedant Karne and Ms. Priya Sharma, who collectively hold 75% of the pre-issue paid-up equity share capital. We may not be able to attract and retain skilled personnel to replace them.

3. WORKING CAPITAL INTENSITY
Our business is working capital intensive, with average debtor days of 58 days and inventory days of 32 days. Our ability to manage working capital effectively is critical to our operations.

4. TECHNOLOGY OBSOLESCENCE
The electronics and technology sector is characterised by rapid technological change. Our failure to adopt new technologies, including in SMT processes and IoT platforms, could impact our competitive position.

EXTERNAL RISKS:

5. COMPONENT SUPPLY CHAIN DISRUPTIONS
We import approximately 40% of our electronic components and subassemblies from global suppliers, primarily from Taiwan, China, and South Korea. Global supply chain disruptions (as seen during COVID-19) could affect our production schedules and costs.

6. FOREIGN EXCHANGE RISK
Our import purchases are denominated primarily in US dollars (USD). Fluctuations in the INR/USD exchange rate could increase our input costs and adversely affect our margins.

7. COMPETITION
We face competition from established domestic CEMS players such as Kaynes Technology, Avalon Technologies, and international electronics manufacturers. Increased competition may pressure our pricing and margins.

8. REGULATORY COMPLIANCE
Changes in government policies including GST rates, import duty on electronics, environmental regulations, and labour laws could increase our compliance costs and operating expenses.

ISSUE-RELATED RISKS:

9. ABSENCE OF PRIOR IPO EXPERIENCE
This is our first public offering. We may face challenges in meeting the enhanced disclosure and compliance requirements applicable to listed companies.

10. LIQUIDITY RISK POST-LISTING
As an SME IPO on NSE Emerge Platform, the trading volumes may be limited and investors may find it difficult to exit their positions at desired prices.

11. USE OF PROCEEDS RISK
Our proposed utilisation of IPO proceeds includes both capex and working capital components. Any adverse change in business conditions could delay the deployment of proceeds or require reallocation.

The above risks are not exhaustive. Investors should read the complete Risk Factors section in the DRHP before making investment decisions.
""",
    },
    {
        "filename": "Nirmaan_Legal_Due_Diligence.pdf",
        "doc_type": "7",
        "section": "Outstanding Litigation and Material Developments",
        "content": """
OUTSTANDING LITIGATION AND MATERIAL DEVELOPMENTS
NIRMAAN TECHNOLOGIES LIMITED

LEGAL DUE DILIGENCE REPORT
Prepared by: Desai & Partners, Advocates (Reference: D&P/2025/NTL/001)

A. LITIGATION INVOLVING THE COMPANY:

1. CIVIL/COMMERCIAL DISPUTES:
   Status: No material civil or commercial disputes are pending against the Company as of the date of filing.
   
   Note: A trade dispute with former vendor ABC Components Pvt. Ltd. (Claim ₹8.5 lakhs) was resolved in February 2024 through mediation. The matter is fully settled with no financial or operational impact.

2. TAX DISPUTES:
   Income Tax: Assessment for FY 2022-23 pending — no demand has been raised.
   GST Disputes: NIL
   Custom Duty: NIL

3. REGULATORY ACTIONS:
   SEBI: No regulatory actions / enquiries
   RoC: No pending compounding applications or penalties
   EPFO / ESI: No outstanding demands

B. LITIGATION INVOLVING THE PROMOTERS:

VEDANT KARNE (MD):
   Civil Disputes: NIL
   Criminal Cases: NIL  
   SEBI Debarment: NOT debarred
   Wilful Defaulter Status: NOT a wilful defaulter
   
PRIYA SHARMA (Whole-time Director):
   Civil Disputes: NIL
   Criminal Cases: NIL
   SEBI Debarment: NOT debarred
   Wilful Defaulter Status: NOT a wilful defaulter

C. MATERIAL DEVELOPMENTS:

1. CONVERSION FROM PRIVATE TO PUBLIC:
   The Company was converted from Nirmaan Technologies Private Limited to Nirmaan Technologies Limited pursuant to a resolution passed at the EGM dated January 10, 2025. The Certificate of Incorporation on conversion was received from the Registrar of Companies, Maharashtra on January 22, 2025.

2. PROPOSED IPO:
   The Board of Directors at its meeting held on January 15, 2025 approved the filing of the DRHP with SEBI for an IPO on the NSE SME Emerge Platform.

3. SIGNING OF AGREEMENT WITH KIRLOSKAR ELECTRIC:
   In February 2025, the Company signed a 3-year supply agreement with Kirloskar Electric Company Limited for PCBA supply worth ₹480 lakhs over the period FY2026-FY2028.

D. LEGAL OPINION:
Based on our review, there are no pending litigation matters that would have a material adverse impact on the Company, its operations, or the proposed IPO. The Company is in compliance with all applicable laws and regulations as of date.

[Signature]
Arjun Desai
Partner, Desai & Partners
Bar Council Registration: MH/2003/456
""",
    },
]


def seed_documents():
    """Index Nirmaan documents into ChromaDB and create DB records."""

    logger.info("=" * 60)
    logger.info("Seeding Nirmaan Technologies Ltd demo documents")
    logger.info("=" * 60)

    db = SessionLocal()

    try:
        nirmaan_uuid = uuid.UUID(NIRMAAN_ID)
        company = db.query(Company).filter(Company.id == nirmaan_uuid).first()
        if not company:
            logger.error(f"Company {NIRMAAN_ID} not found in DB. Run migrations first.")
            return

        logger.info(f"Company found: {company.name}")

        # ── Step 1: Remove stale uploaded_document records for Nirmaan ──────────
        stale = db.query(UploadedDocument).filter(
            UploadedDocument.company_id == nirmaan_uuid
        ).all()
        if stale:
            logger.info(f"Removing {len(stale)} stale UploadedDocument records")
            for s in stale:
                db.delete(s)
            db.commit()

        # ── Step 2: Import embedder and vector store ─────────────────────────────
        logger.info("Loading BGE-M3 embedder...")
        from src.retrieval.bge_m3_embedder import BGEM3Embedder
        from src.retrieval.vector_store import VectorStore, COLLECTION_CLIENT

        embedder = BGEM3Embedder(use_fp16=True)
        vector_store = VectorStore()

        # ── Step 3: Delete any existing Nirmaan chunks from ChromaDB ────────────
        logger.info("Clearing existing Nirmaan chunks from ChromaDB...")
        try:
            deleted = vector_store.delete_by_metadata(
                collection_name=COLLECTION_CLIENT,
                where={"company_id": NIRMAAN_ID}
            )
            logger.info(f"Deleted {deleted} existing chunks")
        except Exception as e:
            logger.warning(f"Could not delete existing chunks: {e}")

        # ── Step 4: Process each document ────────────────────────────────────────
        from src.ingestion.client_data_chunker import ClientDataChunker

        chunker = ClientDataChunker()
        total_chunks = 0

        for doc in DOCUMENTS:
            filename = doc["filename"]
            content = doc["content"].strip()
            doc_type = doc["doc_type"]
            section = doc["section"]

            logger.info(f"Processing: {filename}")

            # Chunk the content
            chunks = chunker.process(
                text=content,
                company_id=NIRMAAN_ID,
                source_file=filename,
            )

            if not chunks:
                # Fallback: create manual chunks if chunker produces nothing
                logger.warning(f"  Chunker produced 0 chunks, using fallback")
                chunk_size = 800
                paragraphs = content.split("\n\n")
                chunk_texts = []
                current = []
                current_len = 0
                for para in paragraphs:
                    if current_len + len(para) > chunk_size and current:
                        chunk_texts.append("\n\n".join(current))
                        current = [para]
                        current_len = len(para)
                    else:
                        current.append(para)
                        current_len += len(para)
                if current:
                    chunk_texts.append("\n\n".join(current))

                texts = chunk_texts
                ids = [f"{NIRMAAN_ID}_{filename}_{i}" for i in range(len(chunk_texts))]
                metadatas_list = [
                    {
                        "company_id": NIRMAAN_ID,
                        "source_file": filename,
                        "doc_type": doc_type,
                        "section": section,
                        "page": str(i + 1),
                    }
                    for i in range(len(chunk_texts))
                ]
            else:
                texts = [c.enriched_text for c in chunks]
                ids = [c.chunk_id for c in chunks]
                # Ensure company_id is set correctly in all chunk metadata
                metadatas_list = []
                for c in chunks:
                    m = dict(c.metadata)
                    m["company_id"] = NIRMAAN_ID
                    m["source_file"] = filename
                    m.setdefault("section", section)
                    m.setdefault("doc_type", doc_type)
                    metadatas_list.append(m)

            logger.info(f"  Embedding {len(texts)} chunks...")
            vectors = embedder.embed_chunks(texts, batch_size=8)

            vector_store.add_chunks(
                collection_name=COLLECTION_CLIENT,
                documents=texts,
                ids=ids,
                dense_vecs=vectors["dense"],
                sparse_vecs=vectors["sparse"],
                metadatas=metadatas_list,
            )
            total_chunks += len(texts)
            logger.info(f"  ✓ Indexed {len(texts)} chunks for {filename}")

            # Create UploadedDocument record
            upload_rec = UploadedDocument(
                company_id=nirmaan_uuid,
                filename=filename,
                doc_type=doc_type,
                status="processed",
            )
            db.add(upload_rec)

        db.commit()

        logger.info("")
        logger.info("=" * 60)
        logger.info(f"✅ Done! Indexed {total_chunks} chunks for Nirmaan Technologies")
        logger.info(f"   {len(DOCUMENTS)} documents created in UploadedDocument table")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Seeding failed: {e}", exc_info=True)
    finally:
        db.close()


if __name__ == "__main__":
    seed_documents()
