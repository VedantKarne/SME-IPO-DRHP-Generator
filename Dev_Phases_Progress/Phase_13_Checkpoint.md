# Phase 13 Checkpoint: Bridge — Wiring the Live Agent Pipeline to the Frontend

## 1. Overview and Purpose

Phase 13 is the single most impactful change in the entire project. The backend AI pipeline (BGE-M3 retriever, LangGraph orchestrator, Groq generation, Gap Detector) was fully built but completely disconnected from the frontend. This phase bridges that gap, turning the project from a mock demo into a genuinely live, end-to-end AI product.

## 2. Critical Gaps Fixed

### GAP 1 — POST /api/agent/run (THE CORE WIRE)
- **Before:** FastAPI and the LangGraph `graph.invoke()` were two separate, unconnected files.
- **After:** `server.py` now exposes `POST /api/agent/run`. It accepts `{company_id, section_name}`, constructs an `AgentState`, calls the real LangGraph orchestrator, captures the `draft_text`, `completeness_score`, and `flagged_gaps` from the result, and saves them to the `GeneratedSection` table. The frontend "⚡ Generate / Regenerate" button calls this endpoint directly.

### GAP 2 — GET /api/eligibility/{company_id} (LIVE CHECKS)
- **Before:** The Eligibility tab showed hardcoded HTML. `eligibility_router.py` existed but was never registered in `server.py`.
- **After:** `server.py` now directly handles `GET /api/eligibility/{company_id}`, calling `EligibilityEngine.check_all()`. The frontend Eligibility tab dynamically renders every check's `name`, `passed`, `reason`, and `clause_id` from the live database.

### GAP 3 — flagged_gaps in GET /api/sections response
- **Before:** `GET /api/sections/{company_id}` omitted the `flagged_gaps` field entirely.
- **After:** The field is now returned. The frontend gap validator panel renders real ICDR clause violations from the DB.

### GAP 4 — GET /api/readiness/{company_id} (NEW ENDPOINT)
- Built a new `/api/readiness/{company_id}` endpoint that computes live sub-scores from `GeneratedSection` data (financial, legal, management category averages).
- **Before:** No readiness scoring existed in the API.
- **After:** Returns `overall_score`, `financial_score`, `legal_score`, `management_score`, `sections_approved`, `total_open_gaps`.

## 3. Frontend Changes

- **IPO Readiness Dashboard:** New default landing tab. Shows 4 score cards (Overall, Financials, Legal, Management), section progress counters, and a smart "Next Actions" list populated dynamically from the DB.
- **Live Eligibility Tab:** Renders the real `EligibilityReport` from the backend, including every check's pass/fail status and ICDR citation.
- **Live Progress Tracker:** Sidebar now shows `X / 25 sections approved` with an animated progress bar updated in real-time.
- **Generate Section Button:** The Document Workspace now has a "⚡ Generate" button per section and a global "⚡ Generate Risk Factors Now" CTA. These call `/api/agent/run` with a loading spinner.
- **Regenerate Button:** Per-section "⚡ Regenerate" button to re-run the LangGraph pipeline on an existing section.
- **Citations Panel:** Displays `supporting_clause_ids` from the DB above the draft text.

## 4. Architecture After This Phase

```
React UI (Vite:5173)
    │
    ├── GET /api/demo/company          → Bootstrap company_id
    ├── GET /api/sections/{id}         → Fetch all sections + flagged_gaps ✅
    ├── GET /api/eligibility/{id}      → Live EligibilityEngine result ✅ NEW
    ├── GET /api/readiness/{id}        → IPO Readiness sub-scores ✅ NEW
    ├── POST /api/agent/run            → LangGraph → Groq → BGE-M3 → DB ✅ NEW
    ├── POST /api/sections/{id}/chat   → Chat Edit (Phase 9)
    ├── POST /api/sections/{id}/approve→ Locking (Phase 9)
    └── POST /api/copilot/ask          → RAG Q&A (Phase 9)
```

**Status:** Phase 13 Complete. The system is now fully live end-to-end.
