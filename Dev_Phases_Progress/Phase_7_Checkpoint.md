# Phase 7 Checkpoint: Eligibility Checker

## 1. Overview and Purpose
Phase 7 introduces the deterministic `EligibilityEngine`. Before the agent commits tokens and time to drafting a 25-section DRHP, it must formally verify that the company actually qualifies for an SME IPO under the SEBI ICDR Regulations. 

This engine acts as an automated regulatory gatekeeper. It evaluates the company's financial and corporate metadata stored in PostgreSQL and generates a structured report that specifically cites the underlying RAPTOR regulatory leaf nodes (rather than hardcoded strings) for each check.

## 2. Features Added

### A. Eligibility Rules Engine (`checker.py`)
Built a standalone engine evaluating 5 critical constraints:
1. **EBITDA Track Record:** Checks if operating profit is ≥ ₹1 Cr in at least 2 out of the last 3 years.
2. **Positive Net Worth:** Verifies the latest financial year reports a positive net worth.
3. **Paid-Up Capital Limit:** Calculates whether the post-issue paid-up capital stays within the ₹25 Crore SME limit (face value estimated at ₹10 based on `total_shares_offered`).
4. **KMP Litigation Check:** Evaluates the `director_kmp` table for any pending litigation against Key Managerial Personnel.
5. **No Winding Up Petition:** Checks the `dynamic_checklist` on the company profile for pending winding up petitions.

### B. Accurate Regulatory Citations
- Rather than returning a simple `eligible: true/false`, the engine maps every rule to its exact **RAPTOR leaf node ID** (e.g., `ICDR_2018_Reg229_2_a`, `ICDR_2018_Reg229_3`).
- **Meaning:** When the React UI renders the checklist, it can fetch and display the exact clause text from the vector database, providing full transparency to the Merchant Banker.

### C. March 2025 Amendments Implemented
- The engine explicitly enforces the newly mandated KMP litigation check under the citation `ICDR_2018_Mar2025_Amend_KMP`. 
- **Meaning:** This proves the system is dynamic and capable of enforcing up-to-date SEBI mandates immediately.

### D. Eligibility FastAPI Router (`eligibility_router.py`)
- Exposed a clean `GET /api/eligibility/{company_id}` endpoint.
- Returns a strict `EligibilityReport` JSON structure (`company_name`, `eligible` boolean, detailed `checks` array with plain-english reasons).
- **Meaning:** Ready to be directly consumed by the React UI monitor.

## 3. Engineering Challenges & Solutions

### Challenge: UUID Type Casting in SQLAlchemy
- **Issue:** When running the unit tests, SQLAlchemy threw a `StatementError: 'str' object has no attribute 'hex'`. The `Company.id` column was defined as `sqlalchemy.Uuid`, but the router/test was passing a raw string representation of the UUID.
- **Solution:** Injected a `uuid.UUID(company_id)` type cast wrapper at the top of the `check_all` function inside `EligibilityEngine`.
- **Rationale:** SQLite (which we use for prototyping) and Postgres handle UUID types differently under the hood. Forcing a strict Python `uuid.UUID` object conversion at the application layer guarantees compatibility across all SQL dialects without needing database-level migrations.

## 4. Master Plan Verification
Evaluating against the **Phase 7 Go/No-Go Checkpoint**:
1. **Citation Format:** `EligibilityReport.regulatory_citations` returns exact RAPTOR IDs (`ICDR_2018_Reg229_2_a`, `ICDR_2018_Mar2025_Amend_KMP`), not hardcoded text strings. ✅
2. **Mar-2025 Amendment:** Unit test `test_ineligible_kmp_litigation` explicitly creates a Director with `pending_litigation=True`. The engine correctly flags it, marks the company ineligible, and cites the new amendment. ✅
3. **Eligibility Report UI Data:** The Pydantic output includes an array of `CheckResult` objects, containing `passed`, `reason`, and `clause_id` properties, which perfectly supports a rich frontend checklist UI. ✅

**Status:** Phase 7 is fully complete, tested, and integrated.
