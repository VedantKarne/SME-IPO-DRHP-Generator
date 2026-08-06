# SESSION HANDOFF — read this first

**You are resuming mid-engagement on the Nirmaan AI SME IPO DRHP Generator.**

This file states where the work actually stands, what is verified, and which of my own earlier conclusions turned out to be **wrong** — so you don't inherit them. Read it in full, then follow **"Your first actions"** at the bottom.

The detailed engineering plan lives at:
`/Users/ADMIN/.claude/plans/master-engineering-directive-elegant-cherny.md` (also reachable via `/plan`).
This file is the summary; that file is the specification.

---

## 1. Where things stand

- **Repo:** `/Users/ADMIN/Documents/3rd_Year_Projects/SME-IPO-DRHP-Generator`
- **Branch:** `remediation/p0-truth-and-safety` — 16 commits ahead of `main`, +3,998 / −2,447 across 61 files

| Phase | Status |
|---|---|
| **P0 — truth & safety** | ✅ Complete, verified against a live server |
| **P2 — ground the corpus** | ✅ Complete. Corpus indexed and citable |
| **P1 — wire the backend** | ✅ Substantially complete (export, HITL, readiness, review persistence, version panel) |
| **P3 — UI honesty** | ✅ Fabricated dashboard/onboarding data removed; real health check |
| **P4 — extend subsystems** | ✅ Audit log populated; LLM circuit breaker |
| **P5 — retrieval tuning** | ⬜ Not started. See "What's left" |

**Tests: 107 passed / 6 failed** (baseline was 94/6). Same six pre-existing failures throughout — no regressions. CI added (there was none).

---

## 2. The corpus is now real — this was the point of P2

```
regulatory_clauses    896      (was 0)
precedent_chunks    5,037      (was 0)
```

Corpus: ICDR 2018 regulations, SEBI ICDR FAQs, SME segment consultation paper, plus six smaller-issuer filings (Advit Jewels, Amir Chand Jagdish Kumar (Exports), Innovision, Om Power Transmission, Rajputana Stainless, PNGS Reva Diamond Jewellery).

**Citations are now traceable.** Before, every regulatory hit rendered `Chapter I | Reg N/A` and every precedent hit `Drhps Png Reva DRHP | Section N/A`. Now:

```
[icdr_amendments_latest_summary.pdf | Chapter IX | Reg 238 | Lock-in of specified securities held by the promoters]
[Rajputana Stainless Limited DRHP | 2026 | Risk Factors]
```

A generated draft cites real filings by name, and the system prompt now requires citation headers to be **copied from retrieved context** rather than composed from memory — which is how a draft against a completely empty index once cited `[Reg 4 | ICDR 2018]`.

---

## 3. Corrections to my own earlier audit — do NOT repeat the wrong versions

- ❌ **"Only 1 of 20 precedents and 1 of 4 regulatory docs were chunked."** Wrong. `save_*_chunks()` wrote one *combined* file misnamed after `chunks[0].source_doc`. All were chunked; only embedding never ran.
- ❌ **"`icdr_2026_consolidated.pdf` is the primary regulatory source."** Wrong. It is 24 pages of SEBI **Stock Brokers** Regulations 2026 — broker conduct, not issuer disclosure — and it is a vector-outline PDF needing OCR. It is now **excluded** via a documented `EXCLUDED_SOURCES` entry. The real ICDR 2018 regulations are in `icdr_amendments_latest_summary.pdf`.
- ❌ **"Version history is real."** Half wrong. The store was real; `VersionHistoryPanel.jsx` was a **syntax error on `main`** so it could never be imported. Repaired in P0 and **now mounted** for the first time.

---

## 4. Hard-won facts — reuse, don't re-derive

- **Ingestion has a CLI now:** `python -m src.ingestion.runners.main_ingestion_runner --selected-precedents [--skip-raptor] [--parse-only] [--max-pages N]`. It previously had none; `max_pages` was a hardcoded literal.
- **Do not** run `scripts/reparse.py` (unrelated) or `master_ingestion_runner` (does not exist). Both are still wrongly documented in `docs/` — **correcting those docs is outstanding**.
- **`JWT_SECRET_KEY` is required**; set in `.env`, throwaway value in `tests/conftest.py`. ⚠️ **Rotate before any real deployment — generated on this machine.**
- Running the whole pytest suite at once is **killed by OOM (exit 137)**. Run per-file.
- Only `Auth.jsx` may use raw `fetch`. Everything else uses `authedFetch`.
- ⚠️ Verification created companies **"P0 Verification Co"** and **"P2 Verification Co"** in the dev DB — delete before a demo.
- Backups from the re-ingestion sit at `Databases/.chroma.bak.*` and `parent_doc_store.db.bak.*`. Delete when you're satisfied.

---

## 5. What's left

**Not done:**
- **P5 — retrieval quality.** RRF weights in `hybrid_retriever.py` are fixed per mode and untuned; FlashRank reranking is unevaluated. There is no labelled query set, and building one is a prerequisite for measuring compliance accuracy.
- **P1.7 — structured onboarding.** `wizard.py` accepts financials, directors and offer details and is now authenticated, but the onboarding UI still collects only five free-text answers, so `director_kmp`, `offer_details` and `financial_statement` stay empty. This is why generated sections score low completeness: there are no company facts to draft from.
- **Litigation chapter.** 14 of 20 real filings have one; the app's 25-section list does not. `doc_type 7` currently routes to Risk Factors as a stopgap.
- **Stale docs.** `docs/ingestion_pipeline.md` and `docs/deployment.md` reference a runner that does not exist and a Docling chunker that is a `pass` stub.

**Known caveats:**
- The sparse index is global across collections and can only re-rank dense hits (`hybrid_retriever.py:72`), so sparse can never surface a document dense missed.
- `VectorStore.add_chunks` rewrites the whole `fallback_sparse.json` per batch — fine at 6k vectors, poor beyond that.
- Four import cycles remain in `src/api` (they resolve at runtime).
- A model transcription slip was observed in one citation ("Jagrish" for "Jagdish") — citations are traceable, not guaranteed verbatim.

---

## 6. Useful commands

```bash
cd /Users/ADMIN/Documents/3rd_Year_Projects/SME-IPO-DRHP-Generator

git log --oneline -5 && git status --short

# Tests — PER FILE (the whole suite at once OOMs). Expect 107 passed / 6 failed.
for f in tests/Phase_tests/test_phase_*.py; do
  echo "## $(basename $f)"; .venv/bin/python -m pytest "$f" -q --tb=no 2>&1 | tail -1
done

# Corpus populated?
.venv/bin/python -c "
from src.retrieval.vector_store import VectorStore
vs=VectorStore()
for c in ['regulatory_clauses','precedent_chunks','client_documents']: print(c, vs.count(c))
"

# Citations traceable? (must NOT show 'Reg N/A' or 'Section N/A')
.venv/bin/python -c "
from src.agent.tools import rag_search
print(rag_search('minimum promoter contribution SME', corpus='regulatory', k=2)[:400])
"

# Re-ingest from scratch
.venv/bin/python -m src.ingestion.runners.main_ingestion_runner --selected-precedents --skip-raptor

# Health (reports real corpus counts, not a green light)
curl -s localhost:8000/api/health | python -m json.tool

# P0 invariants
curl -i -X POST localhost:8000/api/sections/<id>/approve   # expect 401
grep -rn "_BANK\|mock-id\|MOCK" frontend/src/canvas/       # expect nothing
```

---

## 7. Your first actions

1. Read the plan file for full detail, especially §5.1 (Verified Current State) and the Phase P2 section.
2. Confirm the repo matches §1: `git log --oneline -5`, `git status --short`.
3. Ask the user what to pick up next — the obvious candidates are **P1.7 structured onboarding** (which unblocks meaningful completeness scores) and **P5 retrieval tuning** (which needs a labelled query set built first). Get approval before starting.

---

## Standing rule

**Never let the system present unverified output as verified.**

Every defect this engagement fixed was a variant of that: canned prose with a fabricated confidence score, `Chapter I | Reg N/A` citations asserting a lookup that never happened, hardcoded `pass: true` eligibility checks, a permanently green health badge, a "Returned to issuer" state that was never persisted. When adding anything, ask what it claims and whether the claim is earned.
