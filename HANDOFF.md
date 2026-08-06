# SESSION HANDOFF — read this first, then stop and ask

**You are resuming mid-engagement on the Nirmaan AI SME IPO DRHP Generator.**

This file tells you where the work actually stands, what is already established, and — importantly — which of my own earlier conclusions turned out to be **wrong**, so you don't inherit them. Read this in full, then follow **"Your first actions"** at the bottom. Do not start editing code until the user approves.

The detailed engineering plan lives at:
`/Users/ADMIN/.claude/plans/master-engineering-directive-elegant-cherny.md`
(also reachable via `/plan`). This file is the summary; that file is the specification.

---

## 1. Where things stand

- **Repo:** `/Users/ADMIN/Documents/3rd_Year_Projects/SME-IPO-DRHP-Generator`
- **Branch:** `remediation/p0-truth-and-safety` — 3 commits ahead of `main`, working tree clean
- **Commits:**
  - `711b874` — stop the Canvas presenting fabricated content as real output
  - `ca08ca2` — close unauthenticated write paths and stop swallowing failures
  - `22a23f6` — route remaining screens through `authedFetch`

| Phase | Status |
|---|---|
| **P0 — truth & safety** | ✅ **COMPLETE**, verified end-to-end against a live server. Do not redo. |
| **P2 — ground the corpus** | 📋 **Planned in detail. NOT started. NOT approved.** ← next work |
| P1, P3, P4, P5 | Planned only. P1 was deliberately deferred *behind* P2 at the user's choice. |

The user rejected `ExitPlanMode` at the end of the previous session solely to request this handoff. **P2 has never been approved. Get approval before executing.**

---

## 2. What P0 fixed — don't re-investigate this

The headline defect: **the flagship AI Authoring Canvas could not produce a real AI draft, and did not say so.**
`frontend/src/canvas/services/canvasApi.js` sent no `Authorization` header, while `POST /api/agent/run` is auth-guarded (`src/api/server.py:223`). Every call 401'd, was swallowed by a `try/catch`, and returned canned prose from a `REWRITE_BANK` with a fabricated `completeness_score: 80`.

Fixed in P0:
- Canvas API routed through the existing `authedFetch` helper (`frontend/src/utils/auth.js`); all mock banks and catch-fallbacks deleted; real error states rendered at every call site.
- **12 unauthenticated endpoints guarded**, including `POST /api/sections/{id}/approve` — the regulatory sign-off action, previously triggerable by any anonymous caller with no audit trail. Added `require_company_access()` in `auth_router.py` (per-company ownership, not just authentication).
- Hardcoded JWT signing secret removed; the backend now raises at import if `JWT_SECRET_KEY` is unset.
- 933 lines of dead frontend deleted (`screens/Workspace.jsx`, `canvas/editor/EditorPanel.jsx`) — including a fake version history that faked old drafts via `.replace(/the/gi, "the aforementioned")`.
- Two silent-failure paths made loud: the consistency validator (returned `[]` on crash — indistinguishable from "document is clean") and upload embedding failure (marked documents `done` with zero vectors indexed).

**Verified against a running server** (not asserted):

| Check | Result |
|---|---|
| 12 previously-open endpoints, no token | all **401** |
| `GET /` (public) | **200** |
| Own company with valid token | **200** |
| Another company's resource with valid token | **403** |
| `POST /api/agent/run` — the Generate Draft path | **200**, real model output, `completeness_score: 0.7` |

**Tests:** baseline **94 passed / 6 failed** → after P0 **98 passed / 6 failed**. Same six failures (all pre-existing), zero regressions, four new authorization guard tests.

---

## 3. Decisions already made by the user — treat as settled

1. **Remove mock fallbacks entirely** (this overrides the `.kiro` spec's silent-mock mandate). Done in P0.
2. **Re-ingest the regulatory corpus + a 6-filing SME precedent subset**, not all 20 filings.
3. **Realign the section list to real precedent structure, phased**, behind a versioned constant with an alias shim so no existing DB row is orphaned.
4. **P2 regulatory chunking:** fix the chunker *and* the metadata key contract — the thorough option, not the cheap one.
5. **P2 precedent metadata:** curated registry map *plus* TOC-derived chapter attribution — again the thorough option.
6. **`icdr_2026_consolidated.pdf`: EXCLUDE** from the corpus — but still fix the silent-cache bug that concealed its failure.

---

## 4. Corrections to my own earlier audit — do NOT repeat the wrong versions

These were stated confidently in an earlier session and later disproved. The plan file has been updated, but if you skim it, read these first:

- ❌ **"Only 1 of 20 precedents and 1 of 4 regulatory docs were chunked."** **Wrong.** `save_regulatory_chunks()` / `save_precedent_chunks()` write a single *combined* file misnamed after `chunks[0].source_doc`. All 20 precedents (14,752 chunks) and 3 regulatory docs (575 chunks) are chunked. **Only embedding/indexing never ran.**
- ❌ **"`icdr_2026_consolidated.pdf` is the primary regulatory source."** **Wrong.** It is 24 pages of SEBI **Stock Brokers** Regulations 2026 — broker conduct, not issuer disclosure. The genuine 475-page **ICDR 2018** regulations are in `icdr_amendments_latest_summary.pdf`, which parsed fine. Hence decision 6 above.
- ❌ **"Version history is real."** **Half wrong.** The Zustand store is real and DB-backed, but `VersionHistoryPanel.jsx` was a **syntax error on `main`** (an unclosed `SOURCE_META` literal plus a duplicate `timeAgo`, from a botched merge), so the module could never be imported. Syntax repaired in P0; **the panel is still not mounted anywhere.** That is P1 work.

---

## 5. Hard-won facts — reuse these, don't re-derive them

- **The vector store is empty.** All three ChromaDB VECTOR segments hold 0 embeddings. Rows visible in `chroma.sqlite3` are METADATA-segment residue from the upload-pipeline tests — verify with the SQL in §7, not `count()` alone.
- **`main_ingestion_runner.py` has no CLI.** `max_pages` is a hardcoded literal at line 221. Adding argparse is task P2.4.
- **Do not run** `scripts/reparse.py` (unrelated — only recomputes wizard gap flags) or `master_ingestion_runner` (does not exist). Both are wrongly documented in `docs/ingestion_pipeline.md` and `docs/deployment.md`; correcting those docs is part of P2.
- **`JWT_SECRET_KEY` is now required.** It is set in `.env` (gitignored); `tests/conftest.py` sets a throwaway value for tests. ⚠️ **Rotate the `.env` value before any real deployment — it was generated on this machine.**
- **Running the full pytest suite at once gets killed (exit 137, OOM)** — BGE-M3 and docling load together. Run per-file.
- Only `Auth.jsx` may use raw `fetch` (login/register are the unauthenticated entry points). Everything else must use `authedFetch`.
- ⚠️ P0 verification created a company **"P0 Verification Co"** in the dev SQLite DB. Delete it before any demo.

---

## 6. P2 in brief — what you'll be asking approval for

**Goal:** make generation actually retrieve from the SEBI corpus, with citations a reviewer can check.

Chunking is already done; the problem is that **the existing chunks are not worth embedding as they stand.** Two defects would survive re-indexing and make every citation wrong — producing a populated-but-uncitable index, which is the P0 failure mode relocated.

Eight defects (**D1–D8** in the plan file). The two that drive the phase:

- **D1 — Regulatory chunks are one-per-page with 100% default metadata.** All 575 carry `chapter='I'`, `regulation_number='1'`. Root cause: `main_ingestion_runner.py:67` joins pages with `\n`, and pymupdf page text already ends in `\n`, so `"\n\n"` occurs *only* at page boundaries while internal breaks are `" \n \n"`. Every chunk becomes a whole page, and the regex only matches at paragraph start — **0 of 475 matched**, though the text contains 15 `CHAPTER <ROMAN>` headings and 384 numbered lines.
- **D4 — Parent expansion truncates precedent hits to ~100 characters.** `precedent_chunker.py:126` stores `parent_text = chunk_text[:100] + "..."`, and `hybrid_retriever.py:128` *replaces* the retrieved chunk with it. Every precedent hit reaching the LLM would be ~100 chars. Regulatory is unaffected.

Also: a metadata key mismatch (indexer writes `regulation_no`, `rag_search` reads `regulation`/`regulation_number` → citations render `Reg N/A`), precedent metadata derived by splitting filenames (`drhps_png_reva_…` → `company='drhps'`, `exchange='png'`, `year='reva'`), and `enriched_text` that is computed and stored but never actually embedded.

**Tasks:** P2.1–P2.5 (code fixes) → **P2.6 (the ingestion run)** → P2.7–P2.8 (canonical section list, `SECTION_DOC_MAP` repair).

**Sizing (measured, not guessed):** ~3,358 precedent chunks for the 6 SME filings + ~600–1,200 regulatory ≈ **4,000–4,600 vectors**. BGE-M3 and the FlashRank model are already in the local cache, so no downloads. Batch 16 on MPS.

---

## 7. Useful commands

```bash
cd /Users/ADMIN/Documents/3rd_Year_Projects/SME-IPO-DRHP-Generator

# Where are we
git log --oneline -3 && git status --short

# Test baseline — PER FILE (the whole suite at once OOMs)
for f in tests/Phase_tests/test_phase_*.py; do
  echo "## $(basename $f)"; .venv/bin/python -m pytest "$f" -q --tb=no 2>&1 | tail -2
done
# expected: 98 passed / 6 failed overall

# Is the corpus actually populated? (ground truth — VECTOR segments only)
sqlite3 Databases/.chroma/chroma.sqlite3 \
  "SELECT c.name, COUNT(e.id) FROM collections c
     LEFT JOIN segments s ON s.collection=c.id AND s.scope='VECTOR'
     LEFT JOIN embeddings e ON e.segment_id=s.id GROUP BY c.name;"

# No unauthenticated writes (P0 regression check)
curl -i -X POST localhost:8000/api/sections/<id>/approve   # expect 401

# No mock data left in the canvas (P0 regression check)
grep -rn "_BANK\|mock-id\|MOCK" frontend/src/canvas/       # expect no output

# Retrieval returns real, citable metadata (P2 exit criteria 3 & 4)
.venv/bin/python -c "
from src.agent.tools import rag_search
print(rag_search('minimum promoter contribution SME', corpus='regulatory', k=3)[:800])
"   # must NOT contain 'Reg N/A', 'Section N/A', or 'ERROR: Retrieval stack not initialized.'
```

---

## 8. Your first actions in this session

1. Read the full plan at `/Users/ADMIN/.claude/plans/master-engineering-directive-elegant-cherny.md` — especially **§5.1 Verified Current State**, **Implementation status**, and **Phase P2**.
2. Confirm the repo matches §1: `git log --oneline -3` and `git status --short`.
3. **Do not start editing.** Summarise P2 — the 8 tasks, defects D1–D8, the ~4,000–4,600 vector sizing — and **ask the user for explicit approval before executing anything.** The user wants an approval gate before any autonomous run.
4. Once approved: work P2 in order (P2.1 → P2.5, then P2.6, then P2.7 → P2.8), commit per task, and re-run the per-file test baseline against **98 passed / 6 failed**.

---

## Standing rule, carried forward from P0

**Never let the system present unverified output as verified.**

A P0-verified draft cited `[Reg 4 | ICDR 2018]` while the index held **0 vectors** — that citation came from the model's own priors, not from retrieval. Until P2's exit criteria are met, citations in generated drafts are *not* evidence of grounding and must not be shown to a reviewer as verified.
