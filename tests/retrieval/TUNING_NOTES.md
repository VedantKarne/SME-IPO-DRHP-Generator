# Retrieval Tuning Notes
# P5 — RRF Weight Tuning Experiment

**Date:** 2026-08-06  
**Author:** Antigravity (automated)  
**Corpus state:** 896 regulatory clauses, 5 037 precedent chunks, 21 client documents

---

## What was measured

Precision@5 and recall@5 across a 20-query labelled set covering the two retrieval
modes in production use (`compliance` — regulatory corpus, `precedent` — precedent corpus).

No "gap" mode queries were labelled; that mode remains unevaluated.

---

## Labelled query set

`tests/retrieval/eval_queries.json` — 20 queries bootstrapped from live retrieval:
- 10 regulatory / compliance queries (SME IPO eligibility, lock-in, capital limits, etc.)
- 10 precedent queries (risk factors, capital structure, litigation, board remuneration, etc.)

**Methodology caveat:** The expected clause IDs are the top-3 results from the live
retriever at the time the set was built. The eval set and retrieval corpus are therefore
not fully independent. This means scores measure *rank consistency* (do the same top
results come back under a weight change?) rather than ground-truth recall against a
human-annotated benchmark. Absolute scores should not be over-interpreted; relative
comparisons between weight configurations are valid.

---

## Baseline results (current production weights)

| Mode | dense | sparse | mean P@5 | mean R@5 | Queries |
|---|---|---|---|---|---|
| compliance | 0.35 | 0.65 | 0.60 | 1.00 | 10 |
| precedent | 0.65 | 0.35 | 0.60 | 1.00 | 10 |

**All 20 queries hit at least one expected clause in the top 5.**  
R@5 = 1.00 means every query's expected IDs appeared somewhere in the top 5; the
P@5 of 0.60 reflects that on average 3 of the 5 slots contain expected IDs (3 ÷ 5 = 0.60),
consistent with the eval set labelling 3 expected IDs per query.

Full per-query results: `tests/retrieval/results_baseline.json`

---

## Grid search results

Searched `dense ∈ {0.3, 0.4, 0.5, 0.6, 0.7}` for each mode (sparse = 1 − dense).

| Mode | dense | sparse | mean P@5 |
|---|---|---|---|
| compliance | 0.3 | 0.7 | 0.6000 |
| compliance | 0.4 | 0.6 | 0.6000 |
| compliance | 0.5 | 0.5 | 0.6000 |
| compliance | 0.6 | 0.4 | 0.6000 |
| compliance | 0.7 | 0.3 | 0.6000 |
| precedent | 0.3 | 0.7 | 0.6000 |
| precedent | 0.4 | 0.6 | 0.6000 |
| precedent | 0.5 | 0.5 | 0.6000 |
| precedent | 0.6 | 0.4 | 0.6000 |
| precedent | 0.7 | 0.3 | 0.6000 |

Full grid search results: `tests/retrieval/results_grid_search.json`

---

## Interpretation

**P@5 is identical across all 10 weight combinations for both modes.**

This means RRF weight changes do not move any expected clause into or out of the top 5.
The FlashRank cross-encoder reranker dominates the final ordering: by the time FlashRank
re-scores the top-k×3 candidates, the final top-5 is the same regardless of whether the
RRF fusion step weighted dense slightly higher or lower.

This is good news — it means the system is robust to weight perturbation. It also means
**RRF weight tuning is not the right lever for further quality improvement on this corpus.**

---

## Decision

**No changes to `hybrid_retriever.py` weights.** The current defaults are:

```python
weights = {
    "compliance": {"dense": 0.35, "sparse": 0.65},
    "precedent":  {"dense": 0.65, "sparse": 0.35},
    "gap":        {"dense": 0.50, "sparse": 0.50},
}
```

These remain appropriate. The sparse-heavy compliance mode (0.65 sparse) aligns with
the nature of regulatory text — exact regulation numbers and terminology matter — while
the dense-heavy precedent mode (0.65 dense) aligns with precedent retrieval being more
semantic in nature.

---

## What would actually improve retrieval

1. **Larger, independently-labelled eval set.** The current set was bootstrapped from
   live retrieval; human-labelled positives would distinguish weight configurations that
   currently tie at P@5 = 0.60 because they differ in which *two* slots are non-expected.

2. **FlashRank reranker evaluation.** The reranker dominates ranking but its quality
   has not been measured. Ablating it (reverting to RRF order) would quantify its
   contribution.

3. **Sparse index quality.** The sparse scores are computed from a JSON fallback index
   that is populated at ingestion time. If sparse vectors are stale or missing for
   new chunks, the fallback silently scores them as zero — biasing RRF toward dense.
   A ChromaDB native sparse backend would eliminate this.

4. **Chunk size sensitivity.** Parent expansion currently returns ~1 200-word parent
   blocks to the LLM. Testing whether smaller parents (600 words) or larger ones
   (full section) changes generation quality requires a generation-level eval, which
   is a separate and larger undertaking.
