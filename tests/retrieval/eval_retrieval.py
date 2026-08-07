#!/usr/bin/env python3
"""
tests/retrieval/eval_retrieval.py
──────────────────────────────────
Measures retrieval quality (precision@k, recall@k) against the labelled query
set in eval_queries.json, then optionally runs a grid search over RRF weights.

Usage
-----
# Baseline (current weights):
python -m tests.retrieval.eval_retrieval

# Full grid search (prints best weights per mode):
python -m tests.retrieval.eval_retrieval --grid-search

# Save results to JSON:
python -m tests.retrieval.eval_retrieval --out tests/retrieval/results_baseline.json

Methodology note
-----------------
The labelled set is bootstrapped from live retrieval — the expected clause IDs
are actual retrieved results for known-good queries. This means the eval set
and the retrieval corpus are not fully independent. The scores therefore measure
*rank consistency* (does the best result stay at the top?) rather than absolute
ground-truth recall. That is an acceptable constraint given there is no
pre-existing SEBI retrieval benchmark; the scores are still useful for
comparing weight configurations against each other.
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.retrieval.bge_m3_embedder import BGEM3Embedder
from src.retrieval.vector_store import VectorStore
from src.retrieval.parent_doc_store import ParentDocStore
from src.retrieval.flashrank_reranker import FlashRankReranker
from src.retrieval.hybrid_retriever import HybridRetriever

QUERIES_FILE = Path(__file__).parent / "eval_queries.json"
K = 5

CURRENT_WEIGHTS = {
    "compliance": {"dense": 0.35, "sparse": 0.65},
    "precedent":  {"dense": 0.65, "sparse": 0.35},
    "gap":        {"dense": 0.50, "sparse": 0.50},
}


def build_retriever() -> HybridRetriever:
    print("Loading BGE-M3 embedder...", flush=True)
    embedder = BGEM3Embedder()
    vector_store = VectorStore()
    parent_store = ParentDocStore()
    reranker = FlashRankReranker()
    return HybridRetriever(embedder, vector_store, parent_store, reranker)


def retrieve_with_weights(retriever: HybridRetriever, query: str, corpus: str, mode: str, k: int, weights: Dict) -> List[str]:
    query_vectors = retriever.embedder.embed_chunks([query])
    query_dense = query_vectors["dense"][0]
    query_sparse = query_vectors["sparse"][0]
    candidates = []
    if corpus in ("regulatory", "both"):
        candidates.extend(retriever._single_corpus_hybrid_search(
            "regulatory_clauses", query_dense, query_sparse, None, k * 3, weights))
    if corpus in ("precedent", "both"):
        candidates.extend(retriever._single_corpus_hybrid_search(
            "precedent_chunks", query_dense, query_sparse, None, k * 3, weights))
    expanded = []
    for doc in candidates:
        parent_text = retriever.parent_store.expand_to_parent(doc["id"])
        if parent_text:
            doc["text"] = parent_text
        expanded.append(doc)
    reranked = retriever.reranker.rerank(query, expanded, top_k=k)
    return [r.get("id", "") for r in reranked]


def evaluate(retriever: HybridRetriever, queries: List[Dict], k: int = K, weight_overrides: Optional[Dict] = None) -> Dict:
    results = []
    for q in queries:
        query_text = q["query"]
        corpus = q["corpus"]
        mode = q.get("mode", "compliance" if corpus == "regulatory" else "precedent")
        expected = set(q.get("expected_clause_ids_any_of", []))

        weights = (weight_overrides or {}).get(mode, CURRENT_WEIGHTS.get(mode, {"dense": 0.5, "sparse": 0.5}))

        t0 = time.time()
        retrieved_ids = retrieve_with_weights(retriever, query_text, corpus, mode, k, weights)
        latency = time.time() - t0

        retrieved_set = set(retrieved_ids[:k])
        hits = len(retrieved_set & expected) if expected else 0
        precision = (hits / min(k, len(retrieved_ids))) if expected and retrieved_ids else None
        recall = (hits / len(expected)) if expected else None

        results.append({
            "query": query_text,
            "corpus": corpus,
            "mode": mode,
            "retrieved_ids": retrieved_ids,
            "expected_ids": list(expected),
            "hits": hits,
            "precision_at_k": round(precision, 4) if precision is not None else None,
            "recall_at_k": round(recall, 4) if recall is not None else None,
            "latency_s": round(latency, 3),
        })

        if expected:
            status = f"P@{k}={precision:.2f}  R@{k}={recall:.2f}  {'HIT' if hits else 'MISS'}"
        else:
            status = "(no labels)"
        print(f"  [{corpus:10}] {query_text[:50]!r:<54}  {status}")

    labelled = [r for r in results if r["precision_at_k"] is not None]
    agg = {
        "mean_precision_at_k": round(sum(r["precision_at_k"] for r in labelled) / len(labelled), 4) if labelled else None,
        "mean_recall_at_k": round(sum(r["recall_at_k"] for r in labelled) / len(labelled), 4) if labelled else None,
        "labelled_queries": len(labelled),
        "total_queries": len(results),
        "k": k,
    }
    return {"per_query": results, "aggregate": agg}


def grid_search(retriever: HybridRetriever, queries: List[Dict], k: int = K) -> Dict:
    weight_values = [0.3, 0.4, 0.5, 0.6, 0.7]
    mode_query_map = {
        "compliance": [q for q in queries if q.get("corpus") == "regulatory"],
        "precedent":  [q for q in queries if q.get("corpus") == "precedent"],
        "gap":        [q for q in queries if q.get("corpus") == "both"],
    }
    best: Dict[str, Dict] = {}

    for mode, mode_queries in mode_query_map.items():
        if not mode_queries:
            print(f"\nSkipping mode={mode!r} — no queries for this corpus.")
            continue

        print(f"\nGrid search: mode={mode!r} ({len(mode_queries)} queries)")
        best_score = -1.0
        best_w = CURRENT_WEIGHTS[mode]

        for dense in weight_values:
            sparse = round(1.0 - dense, 2)
            w_override = {mode: {"dense": dense, "sparse": sparse}}
            result = evaluate(retriever, mode_queries, k=k, weight_overrides=w_override)
            score = result["aggregate"].get("mean_precision_at_k") or 0.0
            print(f"    dense={dense:.1f} sparse={sparse:.1f}  mean_P@{k}={score:.4f}")
            if score > best_score:
                best_score = score
                best_w = {"dense": dense, "sparse": sparse}

        best[mode] = {"weights": best_w, "best_mean_precision_at_k": best_score}
        print(f"  Best for {mode!r}: {best_w}  P@{k}={best_score:.4f}")

    return best


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--grid-search", action="store_true")
    parser.add_argument("--k", type=int, default=K)
    parser.add_argument("--out", type=str)
    args = parser.parse_args()

    if not QUERIES_FILE.exists():
        print(f"ERROR: {QUERIES_FILE} not found.")
        sys.exit(1)

    queries = json.loads(QUERIES_FILE.read_text())
    print(f"Loaded {len(queries)} queries.")
    retriever = build_retriever()

    if args.grid_search:
        print("\n=== GRID SEARCH ===")
        best = grid_search(retriever, queries, k=args.k)
        print("\n=== BEST WEIGHTS ===")
        print(json.dumps(best, indent=2))
        if args.out:
            Path(args.out).write_text(json.dumps({"type": "grid_search", "best": best}, indent=2))
    else:
        print(f"\n=== BASELINE (k={args.k}) ===")
        result = evaluate(retriever, queries, k=args.k)
        print("\n=== AGGREGATE ===")
        print(json.dumps(result["aggregate"], indent=2))
        if args.out:
            Path(args.out).write_text(json.dumps(result, indent=2))
            print(f"Results written: {args.out}")


if __name__ == "__main__":
    main()
