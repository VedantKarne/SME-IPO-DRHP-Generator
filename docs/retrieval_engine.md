# 🔍 Retrieval Engine

> **Deep dive into the Hybrid RAG retrieval system** — BGE-M3 dual-encoder search, Reciprocal Rank Fusion, FlashRank cross-encoder reranking, parent document expansion, and query-type routing.

---

## Overview

The retrieval engine is the intelligence core of Nirmaan AI. It is responsible for finding the most relevant regulatory clauses and DRHP precedent examples for any given query — with high precision, low latency, and minimal hallucination risk.

**The retrieval stack consists of 5 layers:**

```
Query
  │
  ▼
[1] BGE-M3 Query Encoding    →  dense vector + sparse weights
  │
  ▼
[2] Dual-Branch Search       →  dense (ChromaDB L2) + sparse (inner product)
  │
  ▼
[3] Reciprocal Rank Fusion   →  merged ranked list (RRF, k=60)
  │
  ▼
[4] Parent Doc Expansion     →  child chunks → full parent passages
  │
  ▼
[5] FlashRank Cross-Encoder  →  (query, passage) interaction scoring
  │
  ▼
Top-k reranked results → LLM context
```

---

## Layer 1: Query Encoding

**File**: `src/retrieval/bge_m3_embedder.py`

The same `BGEM3Embedder` used for ingestion encodes the query at runtime:

```python
query_vectors = embedder.embed_chunks([query])
query_dense = query_vectors["dense"][0]    # 1024-dim float list
query_sparse = query_vectors["sparse"][0]  # {"token": weight, ...}
```

Since `BGEM3FlagModel` is loaded as a module-level singleton (`src/agent/tools.py`), there is no model loading overhead per query — the model stays in memory.

---

## Layer 2: Dual-Branch Search

**File**: `src/retrieval/hybrid_retriever.py` → `_single_corpus_hybrid_search()`

### Dense Branch (ChromaDB L2 Similarity)

```python
dense_results = vector_store.query_dense(
    collection_name=collection_name,
    query_dense_vec=query_dense,
    n_results=k,
    where=filters  # Optional metadata filter
)
```

ChromaDB performs approximate nearest neighbor search using its default L2 distance metric. Results are ranked by semantic similarity to the query.

### Sparse Branch (Lexical Inner Product)

```python
# In-memory scan over fallback_sparse_index
for doc_id, doc_sparse in vector_store.fallback_sparse_index.items():
    score = sum(q_weight * doc_sparse.get(token, 0) 
                for token, q_weight in query_sparse.items())
    if score > 0:
        sparse_scores.append((doc_id, score))
sparse_scores.sort(key=lambda x: x[1], reverse=True)
```

The inner product between query sparse vector and document sparse vectors provides exact keyword matching with TF-IDF-like weighting. This is critical for regulatory queries where exact legal terms ("paid-up capital", "Regulation 229") must match precisely.

**Why not BM25?** BGE-M3's sparse weights already encode token importance (similar to BM25 weights but learned from a large corpus), making a separate BM25 index redundant.

---

## Layer 3: Reciprocal Rank Fusion

**Formula**: `RRF_score(d) = Σ weight_branch × (1 / (k_constant + rank_of_d_in_branch))`

```python
rrf_k = 60  # Standard RRF constant (smooths rank differences)

for rank, doc_id in enumerate(dense_ranked_ids):
    rrf_scores[doc_id] += dense_weight * (1.0 / (rrf_k + rank + 1))
    
for rank, doc_id in enumerate(sparse_ranked_ids):
    if doc_id in doc_lookup:  # Only fuse docs from the dense candidate pool
        rrf_scores[doc_id] += sparse_weight * (1.0 / (rrf_k + rank + 1))
```

### Query-Type Adaptive Weights

The weights are tuned based on the query type:

| Query Type | Dense Weight | Sparse Weight | When Used |
|---|---|---|---|
| `"compliance"` | 0.35 | 0.65 | Regulatory checks ("what does SEBI require?") |
| `"precedent"` | 0.65 | 0.35 | DRHP examples ("show me how others wrote this") |
| `"gap"` | 0.50 | 0.50 | Gap resolution (balanced semantic + lexical) |

**Rationale**: Compliance queries often use exact regulatory terminology → sparse search is more precise. Precedent queries require semantic similarity (different companies use different words for the same concept) → dense search is more effective.

### 3× Candidate Buffer

For the reranker to work accurately, it needs a sufficiently rich candidate pool. Instead of retrieving `k` results and reranking, the engine retrieves `k × 3` candidates per corpus:

```python
reg_fused = self._single_corpus_hybrid_search(
    "regulatory_clauses", query_dense, query_sparse, filters, 
    k * 3,  # 3x buffer for reranker
    weights
)
```

This ensures the FlashRank cross-encoder always sees enough candidates to make meaningful discriminations.

---

## Layer 4: Parent Document Expansion

**File**: `src/retrieval/parent_doc_store.py`

After RRF fusion, each retrieved child chunk is expanded to its full parent passage:

```python
for doc in candidates:
    parent_text = parent_store.expand_to_parent(doc["id"])
    if parent_text:
        doc["text"] = parent_text  # Replace child text with full parent
```

**Why this matters**: Child chunks (~200-400 tokens) are small for precision retrieval. But when passed to an LLM, they often lack sufficient context to write a coherent DRHP section. The parent document stores the full section passage (potentially 1000-2000 tokens), giving the LLM much richer material to work with.

Parent-child relationships are stored in `Databases/parent_doc_store.db`:
```sql
CREATE TABLE parent_chunks (
    chunk_id TEXT PRIMARY KEY,    -- Child chunk ID (same as ChromaDB ID)
    parent_id TEXT,               -- Parent chunk ID  
    parent_text TEXT              -- Full parent passage text
)
```

---

## Layer 5: FlashRank Cross-Encoder Reranking

**File**: `src/retrieval/flashrank_reranker.py`

Cross-encoder reranking scores each `(query, passage)` pair jointly — unlike bi-encoders (which score query and passage independently), a cross-encoder "reads" both simultaneously, enabling much more precise relevance judgments.

### FlashRank Setup
```python
from flashrank import Ranker, RerankRequest

ranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2")  
# Model stored in local ./models/ directory
```

The `ms-marco-MiniLM-L-12-v2` model is a fine-tuned passage reranker trained on MS MARCO (Microsoft MAchine Reading COmprehension) — well-suited for legal and regulatory passage retrieval.

### ONNX Runtime Hardware Acceleration

FlashRank uses `onnxruntime` internally. ONNX Runtime automatically selects the fastest available **Execution Provider (EP)**:

| Platform | ONNX Runtime Package | Execution Provider | Effect |
|---|---|---|---|
| **macOS (Apple Silicon)** | `onnxruntime` (standard) | **CoreML EP** — delegates to Apple Neural Engine (ANE) | Near-GPU speed, purpose-built silicon |
| **Windows / Linux + NVIDIA** | `onnxruntime-gpu` | **CUDA EP** — full GPU inference | Fastest option on NVIDIA hardware |
| **Any platform (no GPU)** | `onnxruntime` (standard) | **CPU EP** — optimized ONNX CPU runtime | Fully functional, ~2–3× slower than GPU |

For Windows/Linux NVIDIA users who want FlashRank on GPU:
```bash
pip uninstall onnxruntime -y
pip install onnxruntime-gpu
# Verify: python3 -c "import onnxruntime as ort; print(ort.get_available_providers())"
# Expected: ['CUDAExecutionProvider', 'CPUExecutionProvider']
```

> The `onnxruntime-gpu` package is **mutually exclusive** with `onnxruntime` — install only one. The standard `requirements.txt` installs `onnxruntime` (works on all platforms); replace with `onnxruntime-gpu` for CUDA acceleration.

### Reranking Call
```python
rerank_request = RerankRequest(
    query=query,
    passages=[{"id": d["id"], "text": d["text"], "meta": d["metadata"]} 
              for d in expanded_candidates]
)
results = ranker.rerank(rerank_request)
return results[:top_k]  # Return only top-k after reranking
```

---

## Full Retrieval Flow (rag_search)

**File**: `src/agent/tools.py`

```python
def rag_search(
    query: str,
    corpus: Literal["regulatory", "precedent", "both"] = "both",
    query_type: Literal["compliance", "precedent", "gap"] = "compliance",
    k: int = 5
) -> str:
    results = _retriever.hybrid_retrieve(
        query=query,
        corpus=corpus,
        k=k,
        mode=query_type
    )
    # Format results with citation tags
    for r in results:
        meta = r.get("metadata", {})
        if "regulation" in meta:
            # "[SEBI_ICDR_Regulations | Chapter IV | Reg 229]\n..."
        else:
            # "[AaravTech BSE DRHP | Section Risk Factors]\n..."
```

The formatted output becomes the `regulatory_context` or `precedent_context` field in the `AgentState` — providing the LLM with both the retrieved text and its provenance.

---

## Query Routing (`src/retrieval/router.py`)

The `Router` class classifies incoming queries to determine the optimal retrieval strategy:

| Query Signal | Routed To | Strategy |
|---|---|---|
| Contains "Reg", "ICDR", "Section", "clause" | `regulatory` only | compliance mode |
| Contains "example", "precedent", "draft", company names | `precedent` only | precedent mode |
| Ambiguous or multi-topic | `both` | gap mode (balanced) |

The orchestrator nodes explicitly set the corpus and mode:
- `regulatory_retrieval_node`: `corpus="regulatory"`, `query_type="compliance"`
- `precedent_retrieval_node`: `corpus="precedent"`, `query_type="precedent"`
- `copilot_router.py`: `corpus="both"`, `query_type="compliance"`

---

## Performance Characteristics

| Operation | macOS (MPS) | Windows/Linux (CUDA) | CPU only | Bottleneck |
|---|---|---|---|---|
| BGE-M3 query encoding | 50–200ms | 20–80ms | 200–800ms | GPU warmup on first call |
| ChromaDB dense search (k=15) | 5–20ms | 5–20ms | 5–20ms | In-memory ANN |
| Sparse inner product scan | 10–50ms | 10–50ms | 10–50ms | O(n×m) scan |
| RRF fusion | <1ms | <1ms | <1ms | Pure Python |
| Parent doc expansion | 2–10ms | 2–10ms | 2–10ms | SQLite lookup |
| FlashRank reranking (k=5) | 100–300ms (CoreML/ANE) | 30–100ms (CUDA EP) | 300–800ms (CPU ONNX) | Cross-encoder inference |
| **Total retrieval** | **~200–600ms** | **~80–270ms** | **~550ms–1.7s** | BGE-M3 + FlashRank |

---

## Extending the Retrieval Engine

### Adding New Corpora
1. Add a new collection to `vector_store.py`: `client.get_or_create_collection(name="your_corpus")`
2. Add a new corpus branch in `hybrid_retriever.py`'s `hybrid_retrieve()`.
3. Create a corresponding chunker in `src/ingestion/`.
4. Add `corpus="your_corpus"` as a valid literal in `rag_search()`.

### Tuning Retrieval Parameters
| Parameter | Location | Effect |
|---|---|---|
| `k` (base retrieval count) | `rag_search()` call sites | More context vs. lower precision |
| `k * 3` (buffer multiplier) | `hybrid_retriever.py` | Larger reranker candidate pool |
| `rrf_k` (RRF constant) | `_single_corpus_hybrid_search()` | Smoothing factor (60 is standard) |
| Dense/sparse weights | `hybrid_retriever.py` `weights` dict | Adjust balance per query type |
| `batch_size` in embedder | `bge_m3_embedder.py` | Tune for available RAM |
