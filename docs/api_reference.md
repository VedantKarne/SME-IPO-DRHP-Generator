# 🌐 API Reference

> **Complete reference for all FastAPI endpoints** — request/response models, authentication, error handling, and usage examples.

---

## Base URL

```
http://localhost:8000
```

Interactive documentation (Swagger UI): http://localhost:8000/docs  
OpenAPI JSON schema: http://localhost:8000/openapi.json

---

## Authentication

No authentication is required in the current development version. All endpoints are open.

---

## Wizard Endpoints (`src/api/wizard.py`)

### `POST /api/wizard/company`
Register a new SME company.

**Request Body:**
```json
{
  "cin": "U74999MH2015PTC261188",
  "name": "AaravTech Solutions Pvt Ltd",
  "incorporation_date": "2015-03-12",
  "registered_office": "Office 4B, Tech Hub, Andheri East, Mumbai - 400093",
  "nic_code": "62012",
  "industry": "Software & IT Services"
}
```

**Response `201`:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "cin": "U74999MH2015PTC261188",
  "name": "AaravTech Solutions Pvt Ltd",
  "created_at": "2025-07-11T08:00:00Z"
}
```

**Error `409`:** CIN already exists.

---

### `POST /api/wizard/financials/{company_id}`
Submit 3-year financial data.

**Request Body (Array):**
```json
[
  {"fiscal_year": 2022, "revenue_lakhs": 845.2, "ebitda_lakhs": 112.3, "pat_lakhs": 78.5, "net_worth_lakhs": 420.0, "paid_up_capital_lakhs": 100.0},
  {"fiscal_year": 2023, "revenue_lakhs": 1120.5, "ebitda_lakhs": 165.8, "pat_lakhs": 112.4, "net_worth_lakhs": 532.0, "paid_up_capital_lakhs": 100.0},
  {"fiscal_year": 2024, "revenue_lakhs": 1480.0, "ebitda_lakhs": 224.5, "pat_lakhs": 156.2, "net_worth_lakhs": 688.0, "paid_up_capital_lakhs": 100.0}
]
```

**Response `200`:**
```json
{"inserted": 3, "company_id": "550e8400-..."}
```

---

### `POST /api/wizard/directors/{company_id}`
Submit Director/KMP profiles.

**Request Body (Array):**
```json
[
  {
    "name": "Vedant Karne",
    "din": "09481234",
    "designation": "Managing Director",
    "pending_litigation": false,
    "qualification": "B.Tech, IIT Bombay",
    "experience_years": 12
  }
]
```

**Response `200`:**
```json
{"inserted": 1, "company_id": "550e8400-..."}
```

---

### `POST /api/wizard/offer/{company_id}`
Submit IPO offer structure.

**Request Body:**
```json
{
  "total_shares_offered": 1500000,
  "price_per_share": 80.0,
  "objects_of_offer": "To fund expansion of manufacturing capacity and working capital requirements."
}
```

**Response `200`:**
```json
{
  "id": "...",
  "company_id": "...",
  "total_shares_offered": 1500000,
  "price_per_share": 80.0,
  "total_issue_size_lakhs": 1200.0,
  "objects_of_offer": "..."
}
```

**Note**: `total_issue_size_lakhs` is auto-calculated as `(1,500,000 × 80) / 100,000 = 1200`.

---

## Agent Endpoints (`src/api/server.py`)

### `POST /api/agent/run`
Trigger AI drafting of a single DRHP section.

**Request Body:**
```json
{
  "company_id": "550e8400-e29b-41d4-a716-446655440000",
  "section_name": "Risk Factors"
}
```

**Response `200`** (section drafted):
```json
{
  "status": "success",
  "section_id": "...",
  "section_name": "Risk Factors",
  "completeness_score": 0.8,
  "gaps_count": 2,
  "draft_preview": "The following risk factors may affect..."
}
```

**Notes:**
- This is a **synchronous** call. For long sections, it may take 10–45 seconds.
- The draft is saved to `generated_section` table before response.
- LangGraph HITL interrupt is handled internally — the endpoint always returns.

---

### `GET /api/sections/{company_id}`
Fetch all generated sections for a company.

**Response `200`:**
```json
[
  {
    "id": "...",
    "company_id": "...",
    "section_name": "Risk Factors",
    "draft_text": "...",
    "status": "draft",
    "is_locked": false,
    "completeness_score": 0.8,
    "flagged_gaps": [{"clause_id": "...", "description": "...", "is_critical": true}],
    "created_at": "..."
  }
]
```

---

### `GET /api/readiness/{company_id}`
Get IPO readiness score and section pipeline statistics.

**Response `200`:**
```json
{
  "company_id": "...",
  "overall_score": 32,
  "financial_score": 80,
  "legal_score": 25,
  "management_score": 60,
  "sections_approved": 8,
  "sections_in_draft": 3,
  "sections_pending": 14,
  "total_open_gaps": 12
}
```

Score calculation:
- `overall_score` = `(sections_approved / 25) × 100`
- `financial_score` = average completeness_score of financial sections × 100
- Sub-scores are grouped by section category.

---

### `POST /api/demo/init`
Seed the demo database from the onboarding interview answers.

**Request Body:**
```json
{
  "name": "My Company",
  "industry": "Manufacturing",
  "years": "8 years",
  "revenue": "₹50 crore",
  "litigations": "No pending litigations"
}
```

**Response `200`:**
```json
{"status": "ok", "company_id": "..."}
```

This endpoint creates or updates a company record in the database. Litigation answers containing "yes", "pending", "have" (but not "no", "not") automatically set `pending_litigation=True` on all directors.

---

## Eligibility Endpoint

### `GET /api/eligibility/{company_id}`
Run all 5 SEBI ICDR eligibility checks.

**Response `200`:**
```json
{
  "company_id": "...",
  "company_name": "AaravTech Solutions Pvt Ltd",
  "eligible": true,
  "checks": [
    {"name": "EBITDA Track Record", "passed": true, "clause_id": "ICDR_2018_Reg229_2_a", "reason": "..."},
    {"name": "Positive Net Worth", "passed": true, "clause_id": "ICDR_2018_Reg229_1_b", "reason": "..."},
    {"name": "Post-Issue Paid-Up Capital", "passed": true, "clause_id": "ICDR_2018_Reg229_3", "reason": "..."},
    {"name": "KMP Litigation Check", "passed": true, "clause_id": "ICDR_2018_Mar2025_Amend_KMP", "reason": "..."},
    {"name": "No Winding Up Petition", "passed": true, "clause_id": "ICDR_2018_Reg229_1_c", "reason": "..."}
  ],
  "regulatory_citations": ["ICDR_2018_Reg229_2_a", "ICDR_2018_Reg229_1_b", ...]
}
```

**Error `404`:** Company not found.

---

## Section Review Endpoints

### `POST /api/sections/{section_id}/chat`
Apply a natural language edit to a section via AI.

**Request Body:**
```json
{
  "prompt": "Make this section more investor-friendly and shorter."
}
```

**Response `200`:**
```json
{
  "status": "updated",
  "new_draft_preview": "...",
  "changes_summary": "Section shortened by 15%. Tone adjusted for investor audience."
}
```

**Error `423`:** Section is locked (`is_locked=True`).

---

### `POST /api/sections/{section_id}/approve`
Lock a section (Merchant Banker certification).

**Response `200`:**
```json
{
  "status": "approved",
  "section_id": "...",
  "is_locked": true,
  "status_value": "intermediary_certified"
}
```

**Error `404`:** Section not found.  
**Error `400`:** Section has no draft text to approve.

---

### `GET /api/impact/{field_name}`
Get the cross-section impact map for a data field change.

**Example**: `GET /api/impact/ebitda`

**Response `200`:**
```json
{
  "field": "ebitda",
  "impacted_sections": [
    "Capital Structure",
    "Financial Statements (3 Years)",
    "Management Discussion & Analysis",
    "Basis of Issue Price"
  ],
  "impact_type": "financial",
  "message": "Changing EBITDA data will affect 4 sections that reference financial performance."
}
```

The impact map is deterministic (hardcoded in `impact_router.py`) — it's a lookup table, not an LLM inference.

---

## Copilot Endpoint

### `POST /api/copilot/ask`
Ask the Nirmaan AI Copilot a regulatory question.

**Request Body:**
```json
{
  "company_id": "...",
  "current_section": "Risk Factors",
  "question": "What does SEBI require for listing risk factors in SME DRHP?"
}
```

**Response `200`:**
```json
{
  "answer": "SEBI ICDR Regulations 2018 require SME issuers to disclose all material risk factors [Reg 237 | ICDR 2018] in a manner that enables investors to make an informed investment decision. The risk factors must be organized by severity, with the most material risks listed first [Reg 238(1)(b) | ICDR 2018]...",
  "citations": ["Reg 237 | ICDR 2018", "Reg 238(1)(b) | ICDR 2018"],
  "retrieved_context_count": 3
}
```

The Copilot uses RAG (both regulatory + precedent corpora) to ground its answer. Citations are extracted from the `[Reg X | ICDR 2018]` patterns in the response.

---

## KPI Extraction Endpoint

### `POST /api/upload`
Upload a financial PDF for automatic KPI extraction via Gemini.

**Request**: `multipart/form-data` with field `file` (PDF)

**Response `200`:**
```json
{
  "status": "extracted",
  "company_id": "...",
  "extracted_fields": {
    "revenue_fy2024": 1480.0,
    "ebitda_fy2024": 224.5,
    "pat_fy2024": 156.2,
    "net_worth": 688.0,
    "paid_up_capital": 100.0,
    "company_name": "AaravTech Solutions Pvt Ltd",
    "cin": "U74999MH2015PTC261188"
  },
  "confidence": "high",
  "model": "gemini-2.5-flash"
}
```

**Error `422`:** PDF too large or unsupported format.  
**Error `503`:** Gemini API quota exceeded (retrying with backoff).

---

## HITL Resume Endpoint

### `POST /api/hitl/{thread_id}/resume`
Resume a paused LangGraph agent with human feedback.

**Request Body:**
```json
{
  "action": "revise",
  "feedback": "Please add more detail about cybersecurity risks specific to our SaaS business."
}
```
Or for approval:
```json
{
  "action": "approve"
}
```

**Response `200`:**
```json
{
  "status": "resumed",
  "action_taken": "revise",
  "new_draft_available": true
}
```

**Error `404`:** Thread ID not found in MemorySaver.

---

## Error Responses

All error responses follow this format:
```json
{
  "detail": "Human-readable error message"
}
```

Common HTTP status codes:
- `200` — Success
- `201` — Created
- `400` — Bad request (invalid input)
- `404` — Resource not found
- `409` — Conflict (e.g., duplicate CIN)
- `422` — Validation error (Pydantic)
- `423` — Locked (section is certified)
- `500` — Internal server error
- `503` — Upstream API unavailable (Groq/Gemini quota)

---

## CORS Configuration

The API allows all origins in development:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

For production, replace `allow_origins=["*"]` with the specific frontend origin.
