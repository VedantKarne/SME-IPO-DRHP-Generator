# Hardcoded / Mock Data Log

Tracks anything in the Finance/CA review workflow (Step 4) that is not yet
backed by real, live data, plus schema/design decisions made to avoid a
migration in this pass. Update this file whenever a gap here gets closed.

## Resolved in this step (no longer mock)

The Step 3 dashboard used `screens/finance/data/mockFinancialReview.js`
(`MOCK_FINANCIAL_SUMMARY`, `MOCK_FINANCIAL_REVIEW_QUEUE`) for the Financial
Readiness summary and Financial Review Queue. That file has been **deleted**
— `FinanceDashboard.jsx`, `FinanceSections.jsx`, and
`FinanceReviewQueuePage.jsx` now compute everything from real data:
`GET /api/session/restore` (`sections`, `readiness.financial_readiness`,
`uploaded_documents` — the same payload `screens/Dashboard.jsx` already used
for the Founder view) plus the new `/api/finance/*` endpoints for
statement-level correction/verification history.

## Schema gaps deliberately not migrated this step

**No separate "original" vs "corrected" value on `FinancialStatement`.**
`src/extraction/schema.py`'s `FinancialStatement` has one column per metric
(`revenue_lakhs`, `ebitda_lakhs`, ...) — there's no place to store both the
extracted value and a manual correction side by side. Rather than add
columns (a migration, out of scope this step), a correction:
- overwrites the column, but only after the **old value is written to
  `AuditLog`** (`event_type="financial_correction"`, `query` = `"FYxxxx:
  field: old -> new"`) — so the original is never silently lost, just moved
  to the audit trail instead of a dedicated column.
- sets `FinancialStatement.source = "finance_corrected"`, distinct from the
  existing `"ai_extracted"` / `"promoter_input"` / `"demo_seed"` values, so
  a corrected row is clearly marked as such at a glance.

If a real "show both values side by side" UI is wanted later, the natural
fix is a `financial_statement_correction` table (fiscal_year, field,
old_value, new_value, corrected_by, corrected_at) — a proper migration, not
attempted here.

**No `verified` column on `FinancialStatement`.** "Validate/confirm... as
correct" and "mark verified" are implemented as one action (the task listed
them separately, but nothing in the schema or in real usage distinguishes
them — see `finance_router.py`'s `verify_financial_statement()` docstring).
Verified state is **event-sourced through `AuditLog`** instead of a column:
the latest `financial_verified` / `financial_correction` event for a
`(company, fiscal_year)` pair determines the current state (a correction
after verification implicitly un-verifies the year). `GET
/api/finance/{company_id}/financials/{fiscal_year}/status` derives this on
every call. A dedicated boolean column would be more efficient at scale but
isn't needed at this data volume, and event-sourcing gives correction
history "for free."

**`GeneratedSection.status` gains an informal new value,
`"finance_verified"`**, set by `POST
/api/finance/sections/{id}/finance-review`. `status` is a free-text
`String(30)` column with no DB-level enum constraint (already true of
`"revision_requested"`, added by `locking_router.py` the same way), so this
needed no migration. It is deliberately **not** the same as
`is_locked=True` / `status="intermediary_certified"` — that pairing remains
the Merchant Banker's exclusive certification, untouched by this endpoint.

**`ChatMessage.role` gains two new informal values**, `"finance_comment"`
and `"finance_clarification"`, alongside the existing `"reviewer"` (used by
the Merchant Banker Workspace) and `"user"`/`"assistant"` (chat). Also a
free-text column, no migration needed. The `finance_clarification` value is
what `GET /api/finance/{company_id}/clarifications` filters on to build the
Founder dashboard's new "Clarification Requests" card.

## Duplicated-by-necessity, not by choice

`FINANCE_APPROVABLE_SECTIONS` (the DRHP sections Finance/CA may comment on,
request clarification on, or finance-verify) is defined in **two** places
because JS and Python can't share a literal:
- `src/api/finance_permissions.py` — the real, enforced gate.
- `frontend/src/permissions/financeRolePermissions.js` — used only to
  decide whether to *render* a control.

The backend copy is authoritative; if the two ever drift, the UI might show
a control that then 403s (never a silent bypass the other way — see the
`require_finance_ca` check added to the existing `/api/sections/{id}/approve`
endpoint in `locking_router.py`, which closes that specific gap). Keep both
lists in sync by hand; each file's comment points at the other.

Deliberately **not** reusing `server.py`'s `compute_readiness()`
`financial_sections` list for this, even though the names overlap — that
list feeds the Founder dashboard's "Financials" sub-score ring, and
changing it to match Finance/CA's approval scope would have silently
changed a number the Founder sees, which the task's "do not alter other
roles' behavior" rules out.

## Still placeholder (not built this step)

The Finance/CA nav has 8 items; only **Dashboard, Financial Data,
Documents, DRHP Sections, Review Queue** are real per this task's scope
("wherever they naturally belong across the Documents, Financial Data,
DRHP Sections, and Review Queue pages"). **Evidence, Comments, Activity**
still render `FinanceComingSoon` (unchanged from Step 3) — their
underlying capabilities exist and are exposed *within* the four built
pages instead (evidence viewing on Documents/Financial Data, comments and
clarification requests on DRHP Sections).

## Stale comment, not corrected (out of scope)

`frontend/src/screens/Documents.jsx` (Founder's Documents page) has a
comment claiming "there is no backend 'view raw file' endpoint... out of
scope to wire this up for real uploads." That's now inaccurate — this step
added `GET /api/documents/{upload_id}/file` — but wiring the Founder page's
"view" button to it is a Founder-facing UI change, out of scope for this
Finance/CA-only task, so the comment (and Founder's demo-file-only
behavior) was left as-is.

## Local dev setup, not shipped

A local `.env` (JWT_SECRET_KEY only, LLM keys blank) was created to boot
the backend for testing this step's endpoints. It's already covered by
`.gitignore` (`.env`, `.env.*`) and was never a code change.
