# 🚀 Phase 0 Progress & Engineering Checkpoint
**Project:** SEBI PS04 - SME IPO Offer Document Generator

## 📊 Progress Summary
**Phase 0 (Foundation)**: Successfully completed. We established the core Database schema and the FastAPI backend routes that will power the "Promoter Input Wizard" (the 5-step data intake form).

---

## 🛠️ Features Built & Tested

1. **FastAPI Backend Pipeline (`src/api/wizard.py`)**
   - Implemented `POST /api/wizard/company` to register basic corporate details (CIN, NIC codes, etc.) with duplicate CIN validation.
   - Implemented `POST /api/wizard/financials/{company_id}` for accepting 3-year historical financial statements (Revenue, EBITDA, PAT, Net Worth).
   - Implemented `POST /api/wizard/directors/{company_id}` to store KMP (Key Managerial Personnel) profiles and, critically, their litigation history.
   - Implemented `POST /api/wizard/offer/{company_id}` to define the IPO structure (shares offered and pricing).

2. **Data Validation via Pydantic**
   - Created strict Pydantic schemas (e.g., `CompanyCreate`, `OfferCreate`) to ensure that all data provided by the promoter matches the exact types required before it even hits the database.

3. **Comprehensive Test Suite Coverage (`test_phase_0_wizard_api.py`)**
   - Added full test coverage for all 5 wizard steps (Company, Financials, Directors, Offer Details), fulfilling the M1 Go/No-Go conditions.
   - Verified the existence of downstream schema tables like `generated_section` ensuring readiness for Phase 6.

---

## 🏗️ Engineering Decisions (Phase 0)

### 1. Relational DB (SQLAlchemy) over NoSQL
- **Decision:** We structured the core company data across distinct relational tables (`Company`, `FinancialStatement`, `DirectorKMP`, `OfferDetails`) instead of a single massive JSON blob in MongoDB.
- **Rationale:** The DRHP is a highly structured legal document. Financial arithmetic and specific director litigation checks (which happen in the Eligibility Phase) require rigid data consistency. A relational schema prevents malformed inputs from breaking downstream LLM generation.

### 2. Backend-Side Financial Arithmetic
- **Decision:** In the `add_offer_details` route, the backend automatically calculates `total_issue_size_lakhs = (total_shares * price) / 100,000`.
- **Rationale:** We do not trust the frontend to compute critical financial metrics. Moving this arithmetic to the backend ensures the resulting DRHP has mathematically consistent data across all generated paragraphs.

### 3. Asynchronous-Ready Architecture (FastAPI)
- **Decision:** Chosen FastAPI over older frameworks like Flask or Django.
- **Rationale:** While the current endpoints are standard HTTP POST requests, Phase 6 (Draft Generation via Groq 70B) will require Server-Sent Events (SSE) to stream large blocks of LLM text back to the UI in real-time. FastAPI natively supports high-performance async streaming out-of-the-box, saving us from refactoring later.

---
*Phase 0 acts as the permanent shared state for the AI. With this complete, all downstream RAG operations have a clean structured database to reference.*
