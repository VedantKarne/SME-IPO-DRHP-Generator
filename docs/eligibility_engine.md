# ⚖️ Eligibility Engine

> **SEBI ICDR eligibility checking system** — 5 hard regulatory checks, Pydantic-validated reports, and clause-level citations.

---

## Overview

The Eligibility Engine is a **deterministic, rule-based system** that verifies whether an SME company meets SEBI's ICDR 2018 requirements before drafting begins. It is intentionally **not LLM-powered** — eligibility is a binary, auditable compliance check, not an inference task.

**File**: `src/eligibility/checker.py`  
**API Endpoint**: `GET /api/eligibility/{company_id}`

---

## Architecture

```python
class EligibilityEngine:
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def check_all(self, company_id: str) -> EligibilityReport:
        # 1. Load all relevant data from SQLite
        company = self.db.query(Company).filter(Company.id == uid).first()
        financials = self.db.query(FinancialStatement)...order_by(fiscal_year.desc()).all()
        directors = self.db.query(DirectorKMP)...all()
        offer = self.db.query(OfferDetails)...first()
        
        # 2. Run all 5 checks
        checks = [
            self._check_ebitda(financials),
            self._check_net_worth(financials),
            self._check_paid_up_capital(financials, offer),
            self._check_kmp_litigation(directors),
            self._check_no_winding_up(company)
        ]
        
        # 3. Aggregate result
        eligible = all(c.passed for c in checks if c.mandatory)
        return EligibilityReport(eligible=eligible, checks=checks, ...)
```

---

## Data Models

### `CheckResult` (Pydantic)

```python
class CheckResult(BaseModel):
    name: str         # "EBITDA Track Record"
    passed: bool      # True if condition is met
    mandatory: bool   # Whether failure blocks IPO eligibility (default: True)
    clause_id: str    # "ICDR_2018_Reg229_2_a"
    reason: str       # "Operating profit ≥ ₹1 Cr in 2 out of 3 years."
```

### `EligibilityReport` (Pydantic)

```python
class EligibilityReport(BaseModel):
    company_id: str
    company_name: str
    eligible: bool           # Overall pass/fail
    checks: List[CheckResult]
    regulatory_citations: List[str]  # All clause_id values from checks
```

---

## The 5 Checks

### Check 1: EBITDA Track Record

**Regulation**: `ICDR_2018_Reg229_2_a` (March 2025 amendment)  
**Rule**: Operating profit (EBITDA) ≥ ₹1 Crore in **at least 2 of the last 3 fiscal years**

```python
def _check_ebitda(self, financials: List[FinancialStatement]) -> CheckResult:
    if len(financials) < 3:
        return CheckResult(name="EBITDA Track Record", passed=False, ...,
                           reason="Company does not have 3 years of financial data.")
    
    years_above_1cr = sum(1 for f in financials[:3] 
                          if f.ebitda_lakhs and f.ebitda_lakhs >= 100.0)
    passed = years_above_1cr >= 2
    
    return CheckResult(
        name="EBITDA Track Record",
        passed=passed,
        clause_id="ICDR_2018_Reg229_2_a",
        reason=f"Operating profit ≥ ₹1 Cr in {years_above_1cr} out of the last 3 years."
    )
```

**Note**: ₹1 Crore = ₹100 Lakhs → threshold is `100.0` (financials stored in Lakhs).

---

### Check 2: Positive Net Worth

**Regulation**: `ICDR_2018_Reg229_1_b`  
**Rule**: Net worth must be **positive** in the latest fiscal year

```python
def _check_net_worth(self, financials: List[FinancialStatement]) -> CheckResult:
    latest = financials[0]  # Already sorted descending by fiscal_year
    passed = bool(latest.net_worth_lakhs and latest.net_worth_lakhs > 0)
    
    return CheckResult(
        name="Positive Net Worth",
        passed=passed,
        clause_id="ICDR_2018_Reg229_1_b",
        reason=f"Latest net worth is positive (₹{latest.net_worth_lakhs} Lakhs)."
    )
```

---

### Check 3: Post-Issue Paid-Up Capital

**Regulation**: `ICDR_2018_Reg229_3`  
**Rule**: Post-issue paid-up capital ≤ ₹25 Crore (₹2500 Lakhs)

```python
def _check_paid_up_capital(self, financials, offer) -> CheckResult:
    latest_capital = financials[0].paid_up_capital_lakhs or 0.0
    
    # Calculate new capital from shares offered (assuming ₹10 face value)
    new_capital_lakhs = float(offer.total_shares_offered * 10 / 100000) if offer else 0.0
    
    post_issue_capital = float(latest_capital) + new_capital_lakhs
    passed = post_issue_capital <= 2500.0  # 25 Cr = 2500 Lakhs
    
    return CheckResult(
        name="Post-Issue Paid-Up Capital",
        passed=passed,
        clause_id="ICDR_2018_Reg229_3",
        reason=f"Post-issue capital is ₹{post_issue_capital:.2f} Lakhs (Limit: ₹2500 Lakhs)."
    )
```

**Note**: Face value is assumed ₹10 per share for simplicity. A production implementation would read the face value from the `OfferDetails` table.

---

### Check 4: KMP Litigation

**Regulation**: `ICDR_2018_Mar2025_Amend_KMP` (March 2025 amendment — new requirement)  
**Rule**: No Key Managerial Personnel may have pending litigation

```python
def _check_kmp_litigation(self, directors: List[DirectorKMP]) -> CheckResult:
    litigating_kmps = [d.name for d in directors if d.pending_litigation]
    passed = len(litigating_kmps) == 0
    
    return CheckResult(
        name="KMP Litigation Check",
        passed=passed,
        clause_id="ICDR_2018_Mar2025_Amend_KMP",
        reason="No pending litigation against Key Managerial Personnel." if passed
               else f"Pending litigation found for KMP(s): {', '.join(litigating_kmps)}."
    )
```

This check dynamically responds to user input — if the promoter indicates KMP litigation during the onboarding interview, `POST /api/demo/init` sets `director.pending_litigation = True`, which this check immediately reflects.

---

### Check 5: No Winding Up Petition

**Regulation**: `ICDR_2018_Reg229_1_c`  
**Rule**: No winding up petition pending against the company

```python
def _check_no_winding_up(self, company: Company) -> CheckResult:
    passed = True
    if company.dynamic_checklist and "winding_up_petition" in company.dynamic_checklist:
        passed = not company.dynamic_checklist["winding_up_petition"]
    
    return CheckResult(
        name="No Winding Up Petition",
        passed=passed,
        clause_id="ICDR_2018_Reg229_1_c",
        reason="No winding up petition pending against the company."
    )
```

The `dynamic_checklist` JSON column in the `Company` table allows flexible boolean flags to be set without schema changes.

---

## API Integration

### `GET /api/eligibility/{company_id}`

```python
@app.get("/api/eligibility/{company_id}")
def check_eligibility(company_id: str):
    from src.eligibility.checker import EligibilityEngine
    engine = EligibilityEngine(db_session=db)
    report = engine.check_all(company_id)
    return report.model_dump()
```

**Sample Response:**
```json
{
  "company_id": "550e8400-e29b-41d4-a716-446655440000",
  "company_name": "AaravTech Pvt Ltd",
  "eligible": true,
  "checks": [
    {
      "name": "EBITDA Track Record",
      "passed": true,
      "mandatory": true,
      "clause_id": "ICDR_2018_Reg229_2_a",
      "reason": "Operating profit ≥ ₹1 Cr in 3 out of the last 3 years."
    },
    {
      "name": "Positive Net Worth",
      "passed": true,
      "mandatory": true,
      "clause_id": "ICDR_2018_Reg229_1_b",
      "reason": "Latest net worth is positive (₹850.0 Lakhs)."
    },
    {
      "name": "Post-Issue Paid-Up Capital",
      "passed": true,
      "mandatory": true,
      "clause_id": "ICDR_2018_Reg229_3",
      "reason": "Post-issue capital is ₹1200.00 Lakhs (Limit is ₹2500 Lakhs)."
    },
    {
      "name": "KMP Litigation Check",
      "passed": true,
      "mandatory": true,
      "clause_id": "ICDR_2018_Mar2025_Amend_KMP",
      "reason": "No pending litigation against Key Managerial Personnel."
    },
    {
      "name": "No Winding Up Petition",
      "passed": true,
      "mandatory": true,
      "clause_id": "ICDR_2018_Reg229_1_c",
      "reason": "No winding up petition pending against the company."
    }
  ],
  "regulatory_citations": [
    "ICDR_2018_Reg229_2_a",
    "ICDR_2018_Reg229_1_b",
    "ICDR_2018_Reg229_3",
    "ICDR_2018_Mar2025_Amend_KMP",
    "ICDR_2018_Reg229_1_c"
  ]
}
```

---

## Frontend Integration

The eligibility check is displayed in two places:

### 1. Landing Page (Animated)
At the end of the onboarding interview, a simulated eligibility check animation plays in the chat window. It dynamically reflects the litigation answer from the interview:

```jsx
// Landing.jsx
const hasLit = ['yes', 'yeah', 'have', 'pending'].some(w => litLower.includes(w)) &&
               !['no', 'not'].some(w => litLower.includes(w));

setMessages(prev => [...prev, { type: 'eligibility', hasLit }]);
```

### 2. Dashboard Quick View
The first 4 checks are shown in the Dashboard card (`Dashboard.jsx`) with pass/fail badges. A "Full Report →" button navigates to the dedicated Eligibility screen.

### 3. Eligibility Screen (`Eligibility.jsx`)
Calls `GET /api/eligibility/{company_id}` and renders the full `EligibilityReport` with:
- Overall eligibility badge (✅ Eligible / ❌ Not Eligible)
- Per-check result rows with clause IDs
- Warning cards for failed checks with actionable remediation guidance

---

## Extending the Eligibility Engine

To add a new check:

1. Add a new `_check_*` method to `EligibilityEngine`:
```python
def _check_new_rule(self, ...) -> CheckResult:
    # Your check logic
    return CheckResult(
        name="New Rule Name",
        passed=result,
        clause_id="ICDR_2018_RegXXX",
        reason="..."
    )
```

2. Add it to the `check_all()` method's `checks` list.

3. Update the frontend `Eligibility.jsx` to display the new check (it auto-renders from the API response, so no changes needed if the response structure is the same).
