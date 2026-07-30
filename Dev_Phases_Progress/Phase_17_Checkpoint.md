# Phase 17: Document Upload Pipeline, Sync Intelligence & Workspace Polish

## 1. Overview and Objectives

Phase 17 was one of the most comprehensive full-stack sessions in the project's lifecycle. It spanned from the early morning of July 30, 2026 to late that evening, and touched virtually every layer of the application — from the database schema all the way to the React UI.

The session's core objectives were:

1. **Complete the document upload pipeline** — wire the frontend upload button to a real backend endpoint that actually processes, classifies, and chunks documents.
2. **Build a comprehensive test suite** covering every layer of the upload pipeline.
3. **Fix all live runtime bugs** discovered by the user during actual end-to-end testing.
4. **Implement Intelligent Sync Status** — a traffic-light system (🔴/🟠/🟢) that gives users instant visual feedback on the state of every DRHP section relative to their uploaded documents.
5. **Fix inline GAP markers** leaking into the draft text displayed in the workspace.

---

## 2. Files Added (New Files Created This Session)

### `src/extraction/table_extractor.py` [NEW]
- **Purpose**: A structured data extractor to pull financial tables from documents.
- **Features**: Uses a Pydantic schema to validate extracted tables. Integrates with Gemini API for AI-powered extraction. Produces `FinancialTable` DB records.
- **Rationale**: The existing `FinancialTableParser` was a raw parser; this new file wraps it into a clean service layer usable from the upload pipeline.

### `src/api/admin_router.py` [NEW]
- **Purpose**: Admin-only API endpoints for managing the vector store and ChromaDB collections.
- **Features**:
  - `GET /api/admin/vector-store/count` — returns count of chunks in ChromaDB
  - `DELETE /api/admin/vector-store/clear` — wipes the `client_documents` collection
  - `GET /api/admin/vector-store/status` — health check for the vector store
- **Rationale**: Provides operators and developers a maintenance interface for the knowledge base without needing direct DB access.

### `tests/Phase_tests/test_phase_11_upload_pipeline.py` [NEW]
- **Purpose**: Comprehensive test suite for the entire document upload and processing pipeline.
- **Test Classes (8 total, 25+ tests)**:
  - `TestDocClassifier` — 7 doc categories, keyword fast-path, Gemini mock, missing API key graceful handling
  - `TestOCRFallback` — OCR triggered/not-triggered based on Docling output density, graceful failure without Tesseract binary
  - `TestTableExtractorSchemas` — Pydantic model validation, Gemini mock, file cleanup
  - `TestBackgroundProcessing` — `done`/`error` status lifecycle, background job behavior
  - `TestUploadEndpoint` — Multipart form upload, status polling, authentication guard
  - `TestDeleteEndpoint` — Document deletion, cascading DB cleanup, ChromaDB chunk cleanup
  - `TestAdminRoutes` — Vector store count/clear/status endpoints, auth protection
  - `TestPhase12E2E` — Full pipeline integration: upload → classify → chunk → vector store insert → status `done`

### `tests/Phase_tests/test_phase_12_e2e_workspace.py` [NEW]
- **Purpose**: End-to-end integration test simulating the complete user flow from upload to workspace section display.
- **Features**: Tests that after a document is uploaded and processed, the sections API correctly reflects the new state with updated sync indicators.

---

## 3. Files Modified (Significant Edits This Session)

### `src/api/document_upload_router.py` [MODIFIED]
- **Change 1 — URL Fix**: The upload endpoint URL was mismatched between the router and the frontend. Standardized the URL so both sides agree.
- **Change 2 — Cascading Deletion**: Enhanced `delete_document` to cascade:
  1. The `UploadedDocument` SQL record
  2. All associated ChromaDB vector chunks (using `{"$and": [...]}` multi-filter)
  3. All `GeneratedSection` drafts for the company, resetting to `pending`
- **Change 3 — Descriptive File Naming**: Added `DOC_TYPE_NAMES` mapping and logic to rename uploaded files from arbitrary client filenames to clean, descriptive names (e.g., `Audited_Financial_Statements_4f1b2a.pdf`) before saving to disk, logging to the DB, and inserting into ChromaDB metadata.

### `src/api/server.py` [MODIFIED — Extensive]

#### `SECTION_DOC_MAP` Dictionary
Maps each of the 25 DRHP sections to the `doc_type` integers of the client documents required to generate it.

#### `DOC_TYPE_LABELS` Dictionary
Human-readable names for each `doc_type` integer (e.g., `"0"` → `"Audited Financial Statements"`).

#### `SECTIONS_25` Canonical List
The authoritative ordered list of all 25 DRHP sections, mirroring the frontend's constant.

#### Rewritten `get_company_sections` Endpoint
The endpoint was completely rewritten with a 5-stage computation:
1. Loads all `GeneratedSection` records and builds a `section_map` dict
2. Loads all done `UploadedDocument` records and builds `doc_latest_uploads` timestamp map
3. Iterates through all 25 sections in canonical order
4. Computes precise `sync_status` using the state machine
5. Returns a full 25-item list with `sync_status`, `missing_docs`, `unsynced_docs`

#### GAP Marker Stripping
A 4-step regex pipeline strips `⚠️ GAP:` markers from `draft_text` before saving to DB:
1. Remove full lines that are only a GAP marker
2. Replace inline mid-sentence GAP markers with `[information pending]`
3. Clean orphaned `⚠️` emoji
4. Collapse extra blank lines

#### Admin Router Registration
`app.include_router(admin_router)` added to mount new admin endpoints.

### `src/api/session_router.py` [MODIFIED]
- **Change**: The `/session/restore` endpoint's hardcoded section query was replaced with a call to `get_company_sections()`, ensuring sync logic is applied consistently on every page load.

### `src/extraction/schema.py` [MODIFIED]
- **Change**: Added `updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())` to the `GeneratedSection` model.
- **DB Migration**: Column added directly via SQLite since SQLAlchemy does not auto-migrate:
  ```bash
  sqlite3 Databases/app_state.db "ALTER TABLE generated_section ADD COLUMN updated_at DATETIME;"
  ```

### `frontend/src/screens/Workspace.jsx` [MODIFIED — Extensive]
- **Traffic-light dots in sidebar** — replaced text-based status labels with 🔴/🟠/🟢 emoji dots, each with a native HTML `title` tooltip
- **Orange Sync Banner** — warning banner with list of unsynced documents and a 1-click "Sync" button
- **Fallback stub fix** — `mergedSections` default `sync_status` changed from `'green'` to `'red'`
- **`authedFetch` authorization** — all API calls updated to use the JWT-attaching utility

### `src/eligibility/checker.py` → via `src/api/session_router.py` [MODIFIED]
- **Change**: Replaced hardcoded mock eligibility object with a real `EligibilityEngine` call, fixing the blank screen crash in the Eligibility tab.

---

## 4. Bugs Fixed

### 🔴 Bug 1: 404 on Document Upload
- **Symptom**: `POST /api/documents/upload/{company_id}` → 404 Not Found
- **Root Cause**: URL path mismatch. The frontend called `/api/documents/upload/{id}` but the router registered a different path segment.
- **Fix**: Standardized the route URL in `document_upload_router.py`.

### 🔴 Bug 2: Eligibility Screen Blank Page
- **Symptom**: Clicking "Eligibility Engine" tab caused a blank screen crash.
- **Root Cause**: Session restore returned a mock eligibility dict with wrong key names that caused a React render crash.
- **Fix**: Replaced mock with real `EligibilityEngine` call returning a properly structured Pydantic model.

### 🔴 Bug 3: Document Delete Not Clearing ChromaDB Chunks
- **Symptom**: After deleting a document, old vector chunks remained in ChromaDB.
- **Root Cause**: `delete_document` only deleted the SQL record. ChromaDB's flat dictionary filter (`{"company_id": id}`) is silently ignored for multi-key queries.
- **Fix**: Used `{"$and": [...]}` operator; added explicit ChromaDB deletion and GeneratedSection reset.

### 🔴 Bug 4: Workspace "Generate" Button Silently Failing
- **Symptom**: Generate button spinner appeared but no draft was ever produced.
- **Root Cause**: `fetch()` calls had no `Authorization` header. Backend returned 401, which the frontend swallowed silently.
- **Fix**: Replaced all `fetch()` with `authedFetch` from `../utils/auth`.

### 🟠 Bug 5: All Sections Showing Green Dots
- **Symptom**: Every section showed green on load even with nothing uploaded or generated.
- **Root Cause (3 layers)**:
  1. `get_company_sections` only returned sections already in the DB, so missing ones used the frontend's green default.
  2. `session/restore` had its own query bypassing the sync logic.
  3. Frontend `mergedSections` fallback defaulted to `sync_status: 'green'`.
- **Fix**: All 3 layers addressed independently.

### 🟠 Bug 6: Orange Banner Showing Empty Document List
- **Symptom**: For doc-independent sections like "About the Company", the orange sync banner showed: *"New documents () have been uploaded..."* (empty parentheses).
- **Root Cause**: Banner condition checked only `sync_status === 'orange'`, not whether `unsynced_docs` was non-empty.
- **Fix**: Added guard: `selected?.unsynced_docs?.length > 0`.

### 🟠 Bug 7: Incorrect State Machine Logic (4 iterations)
- **Final correct state machine** after 4 rounds of user feedback and refinement (see Section 5 below).

### 🟠 Bug 8: Inline ⚠️ GAP Markers in Draft Text
- **Symptom**: `⚠️ GAP: Year of incorporation` appearing directly in the prose text visible to users.
- **Root Cause**: `flag_gaps()` extracted markers into `flagged_gaps` but never stripped them from `draft_text`.
- **Fix**: 4-step regex post-processing pipeline in `server.py` before saving. Retroactive DB cleanup for existing records.

### 🟡 Bug 9: Cascading Delete Not Resetting Workspace
- **Symptom**: After document deletion, workspace still showed old generated drafts.
- **Root Cause**: No FK relationship between `UploadedDocument` and `GeneratedSection`, so cascade didn't apply.
- **Fix**: Explicit query to reset all `GeneratedSection` rows on document deletion.

### 🟡 Bug 10: Non-Descriptive File Names in Vector Store
- **Symptom**: ChromaDB chunks had `source_file` metadata like `WhatsApp Image 2024-03.pdf`.
- **Fix**: `DOC_TYPE_NAMES` mapping + pre-save rename logic produces clean filenames.

---

## 5. The Document Sync State Machine

```
For each DRHP section S:
  required_docs = SECTION_DOC_MAP.get(S.name, [])
  uploaded_docs = {doc_type: max(uploaded_at)} for all done UploadedDocuments
  missing_docs  = [d for d in required_docs if d not in uploaded_docs]
  stale_docs    = [d for d in required_docs if uploaded_docs[d] > S.updated_at]
  has_gaps      = bool(S.flagged_gaps)

  STATE:
    if S.is_locked        → GREEN  (promoter approved)
    elif no required_docs → RED    (not drafted yet)
                          → ORANGE (drafted but has_gaps)
                          → GREEN  (drafted and gap-free)
    elif missing_docs     → RED    (blocked by absent docs)
    elif not drafted      → ORANGE (all docs present, ready to generate)
    elif stale_docs       → ORANGE (doc re-uploaded after draft)
    elif has_gaps         → ORANGE (drafted but gaps remain)
    else                  → GREEN  (fully complete)
```

---

## 6. Test Suite Details

### Endpoints Tested
| Endpoint | Test Class | Coverage |
|---|---|---|
| `POST /api/documents/upload/{company_id}` | TestUploadEndpoint | Multipart, auth guard |
| `GET /api/documents/status/{company_id}` | TestUploadEndpoint | Status polling |
| `DELETE /api/documents/{document_id}` | TestDeleteEndpoint | SQL + ChromaDB + Section reset |
| `GET /api/admin/vector-store/count` | TestAdminRoutes | Returns integer |
| `DELETE /api/admin/vector-store/clear` | TestAdminRoutes | Wipes collection |
| `GET /api/admin/vector-store/status` | TestAdminRoutes | Health check |
| `GET /api/sections/{company_id}` | TestPhase12E2E | Sync status computation |

### Test Fix Iterations
**Round 1 (24 pass, 22 fail):** `get_db` dependency override not binding — routers used local `get_db` functions not importable for override. Fixed by importing `get_db` from `db_session` in all routers.

**Round 2 (38 pass, 8 fail):** Lazy imports of `google.generativeai` inside functions couldn't be patched. Fixed by adding module-level imports in `doc_classifier.py`, `table_extractor.py`, `admin_router.py`.

**Round 3 (44 pass, 2 fail):** SQLAlchemy UUID column receiving un-hyphenated strings. Fixed by explicit `uuid.UUID(company_id_str)` casting.

**Final: 46/46 pass, 0 skip, 0 error.**

---

## 7. Key Engineering Lessons & Rationale

| Decision | Rationale |
|---|---|
| Reuse `document_upload_router.py` not new `documents.py` | Already registered in `server.py`; creating a new file = dead duplicate |
| Backend `SECTIONS_25` list mirrors frontend | Ensures section ordering consistent; backend was returning sections in DB insertion order before |
| `updated_at` on `GeneratedSection` | Core enabler for stale-draft detection; without it, impossible to know if a doc was uploaded after generation |
| `[information pending]` as inline gap replacement | Preserves sentence structure; raw removal creates broken sentences |
| Retroactive DB cleanup for existing records | Respects already-generated work; avoids forcing user to re-generate |
| Locked sections always Green | Represents a deliberate approval decision; retroactively flagging them Orange would be confusing |
| `$and` operator for ChromaDB multi-filter | Flat dict filter silently ignored by ChromaDB — critical data integrity requirement |

---

## 8. DRHP Section Dependency Map

| Document Type | ID | Sections Affected |
|---|---|---|
| Audited Financial Statements | `"0"` | Financial Statements (3 Years), Financial Information, Management Discussion & Analysis, Capital Structure |
| Board Resolution for IPO | `"1"` | General Information, History and Corporate Structure, Objects of the Offer |
| Factory Licence / Registration | `"2"` | Government and Other Approvals, Our Business, Risk Factors |
| Pollution Certificate | `"3"` | Government and Other Approvals, Our Business, Risk Factors |
| Factory Insurance Policy | `"4"` | Our Business, Risk Factors |
| Trademark Certificates | `"5"` | Our Business, Government and Other Approvals |
| Material Vendor & Customer Contracts | `"6"` | Our Business, Risk Factors |
| Litigation / Legal Notices | `"7"` | Outstanding Litigations and Material Developments, Risk Factors |
| GST Registration Certificate | `"8"` | General Information, Government and Other Approvals |
| Memorandum & Articles of Association | `"9"` | History and Corporate Structure, Capital Structure |

---

## 9. Current State at End of Phase 17

- ✅ Document upload pipeline fully operational end-to-end
- ✅ Background classification, OCR fallback, chunking, and vector store insertion working
- ✅ All 46 tests in `test_phase_11_upload_pipeline.py` pass (0 skip, 0 error)
- ✅ Traffic-light sync status system implemented and functioning correctly
- ✅ Orange banner appears only when specific unsynced documents triggered the state
- ✅ Inline GAP markers stripped from draft text; gaps displayed only in the flagged gaps panel
- ✅ Cascading delete correctly clears SQL, ChromaDB, and workspace canvases
- ✅ Descriptive file naming for all uploaded documents
- ✅ Eligibility Engine connected (no longer returning mock data)
- ⏳ Outstanding: User-facing flow to address and resolve specific flagged gaps
- ⏳ Outstanding: Final `promoter_reviewed` locking flow end-to-end test
