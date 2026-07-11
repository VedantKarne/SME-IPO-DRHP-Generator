# 🗄️ Ingestion Pipeline

> **Complete reference for the document processing pipeline** — from raw PDFs to indexed, retrievable knowledge chunks in ChromaDB.

---

## Overview

The ingestion pipeline is a **one-time offline process** that transforms raw PDF documents into a dual-corpus vector knowledge base. It is orchestrated by `src/ingestion/runners/master_ingestion_runner.py`.

```
Original_Docs/
├── Regulatory/    (SEBI ICDR 2018 PDFs)
└── Precedents/    (Real DRHP filings)
         │
         ▼
   PDF Parsing (PyMuPDF + Docling)
         │
         ▼
   Chunking (RegulatoryChunker / PrecedentChunker)
         │
         ├──► RAPTOR Tree (Groq) ──┐ [Regulatory only]
         │                         │
         └──────────────────────── ┤
                                   ▼
                         BGE-M3 Embedding (CUDA / MPS / CPU)
                                   │
                                   ▼
                    ChromaDB Indexing + Sparse JSON
```

---

## Input File Conventions

### Regulatory PDFs
- Place in `Original_Docs/Regulatory/`
- Filename: any `.pdf` (e.g., `SEBI_ICDR_2018.pdf`)
- The pipeline parses these with PyMuPDF (text extraction) and passes through `RegulatoryChunker`

### Precedent DRHPs
- Place in `Original_Docs/Precedents/`
- **Required filename format**: `Company_Exchange_Year.pdf`
  - Example: `AaravTech_BSE_2024.pdf`
  - `Company`, `Exchange`, `Year` become metadata on each chunk
- The pipeline processes these with Docling (layout-aware parsing) and `PrecedentChunker`

---

## Step 1: PDF Parsing (`src/ingestion/pdf_parser.py`)

### PyMuPDF Path (Regulatory)
```python
import fitz  # PyMuPDF
doc = fitz.open(path)
for page in doc:
    text = page.get_text()
    # Produces ParsedDocument with text + page_num metadata
```
- Fast, text-only extraction
- Page-level metadata preserved
- Best for text-dense regulatory documents

### Docling Path (Precedents)
```python
from docling.document_converter import DocumentConverter
converter = DocumentConverter()
result = converter.convert(path)
# Returns structured document with heading hierarchy + table awareness
```
- Layout-aware: identifies headings, section boundaries, tables, captions
- Necessary for complex DRHP formats with multi-column layouts

### Caching
Parsed documents are cached as JSONL files in `Parsed_Docs/regulatory/` and `Parsed_Docs/precedent/`. On subsequent runs, the pipeline loads from cache (skipping Docling's slow layout analysis), significantly reducing re-run time.

---

## Step 2a: Regulatory Chunking (`src/ingestion/regulatory_chunker.py`)

The `RegulatoryChunker` splits ICDR text on regulatory structural boundaries:

### Splitting Logic
- Detects chapter headings (e.g., "CHAPTER IV — SME LISTINGS")
- Detects regulation numbers (e.g., "229.", "229(1)", "229(1)(a)")
- Creates one `RegulatoryChunk` per provision/sub-provision

### Context Enrichment (`src/ingestion/context_enricher.py`)
Each chunk is enriched with a breadcrumb path before embedding:

```
Original text:
"...the post-issue paid up capital shall not exceed rupees twenty five crore..."

Enriched text:
"[Context: SEBI ICDR 2018 > Chapter IV > SME Listings > Reg 229(3)]
...the post-issue paid up capital shall not exceed rupees twenty five crore..."
```

This injection makes the embedding spatially aware of the regulatory hierarchy, improving retrieval accuracy for queries like "what are the capital limits for SME IPOs?".

### RegulatoryChunk Schema
```python
class RegulatoryChunk:
    clause_id: str          # e.g., "ICDR_2018_Reg229_3"
    parent_id: str          # Parent chapter ID
    chapter: str            # e.g., "Chapter IV"
    regulation_number: str  # e.g., "229(3)"
    text: str               # Enriched chunk text
    source_doc: str         # Source PDF filename
```

---

## Step 2b: Precedent Chunking (`src/ingestion/precedent_chunker.py`)

The `PrecedentChunker` uses Docling's `HybridChunker` for structure-aware chunking:

### Parent-Child Architecture
A two-level chunk hierarchy is created:

- **Child chunks** (small, ~200-400 tokens): Used for precision retrieval. Indexed in ChromaDB.
- **Parent chunks** (full section text): Stored in `parent_doc_store.db`. Returned to the LLM for rich context.

When a child chunk is retrieved by the RAG engine, `ParentDocStore.expand_to_parent()` swaps it with the full parent passage — giving the LLM more coherent context while keeping search precision.

### PrecedentChunk Schema
```python
class PrecedentChunk:
    chunk_id: str     # Unique ID for ChromaDB
    parent_id: str    # Parent section ID
    text: str         # Chunk text
    metadata: {
        "company": str,   # From filename
        "exchange": str,  # From filename
        "year": str,      # From filename
        "section": str    # DRHP section name (detected by Docling heading path)
    }
```

---

## Step 3: RAPTOR Summary Tree (`src/retrieval/raptor.py`)

RAPTOR (Recursive Abstractive Processing for Tree-Organized Retrieval) is applied **only to the regulatory corpus** to build a hierarchical understanding layer.

### Tree Construction

```python
def build_raptor_tree(regulatory_chunks: List[Dict]) -> RaptorTree:
    # Step 1: cluster_by_category() — groups chunks by chapter/regulation type
    clusters = cluster_by_category(regulatory_chunks)
    
    # Step 2: For each category cluster, generate a Level-2 summary via Groq
    level2_nodes = [summarize_with_groq(cluster_text, level="regulation_group") 
                    for cluster in clusters]
    
    # Step 3: cluster_by_theme() — groups Level-2 nodes into broad themes
    l2_clusters = cluster_by_theme(level2_nodes)
    
    # Step 4: Generate Level-1 summaries
    level1_nodes = [summarize_with_groq(theme_text, level="thematic_category")
                    for theme in l2_clusters]
    
    # Step 5: Generate root summary
    root = summarize_with_groq(all_l1_text, level="root")
    
    return RaptorTree(root, level1_nodes, level2_nodes, regulatory_chunks)
```

### Summary Prompt
```
Summarize the following regulatory texts into a coherent {level} summary. 
Keep it concise but ensure key obligations and requirements are preserved.
```

Model: `groq/llama-3.3-70b-versatile`, `temperature=0.3`, `max_tokens=1024`

### Node Metadata
Each RAPTOR node is tagged with `chunk_level`: `"clause"` | `"raptor_level_2"` | `"raptor_level_1"` | `"raptor_root"`. This allows filtering by granularity during retrieval.

---

## Step 4: BGE-M3 Embedding (`src/retrieval/bge_m3_embedder.py`)

### Model Configuration
```python
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel('BAAI/bge-m3', use_fp16=True)
```

- `use_fp16=True`: Uses 16-bit floating point — halves memory, negligible accuracy loss. Compatible with all hardware backends (CUDA, MPS, CPU).
- **On CPU**: `use_fp16=True` is silently downcast to `float32` on platforms without native FP16 support — no manual intervention needed.
- Model is loaded once as a singleton in `src/agent/tools.py` to avoid repeated initialization overhead.

### Embedding Call
```python
output = model.encode(
    texts,
    batch_size=12,         # Tuned for M-series RAM
    max_length=8192,       # Supports very long regulatory passages
    return_dense=True,     # 1024-dim semantic vectors
    return_sparse=True,    # Lexical weight dicts
    return_colbert_vecs=False  # Disabled (memory saving)
)
```

### Output Format
```python
{
    "dense": [[0.032, -0.18, ...], ...],      # List of 1024-float lists
    "sparse": [{"the": 0.4, "capital": 1.2, ...}, ...]  # List of token-weight dicts
}
```

### Hardware Acceleration

BGE-M3 uses PyTorch under the hood, which auto-selects the best available backend:

| Platform | Backend | What to install |
|---|---|---|
| **macOS (Apple Silicon)** | **MPS** — Metal Performance Shaders via Apple GPU | Standard `pip install torch` (MPS built-in) |
| **Windows / Linux with NVIDIA** | **CUDA** — runs on GPU | `pip install torch --index-url https://download.pytorch.org/whl/cu121` |
| **Any platform, no GPU** | **CPU** — fully functional, slower | Standard `pip install torch` |

- **`accelerate` library**: Ensures HuggingFace model device placement dispatches to MPS or CUDA automatically when available. Without `accelerate`, models may silently fall back to CPU even when a GPU is present.
- No code changes are needed between platforms — PyTorch's device detection is transparent.

> **CUDA batch size tip**: On NVIDIA GPUs with VRAM ≥ 8 GB, you can safely increase `batch_size` from 12 to 32 or higher in `embed_chunks()` calls for significantly faster ingestion throughput.

---

## Step 5: ChromaDB Indexing (`src/retrieval/vector_store.py`)

### Collection Initialization
```python
client = chromadb.PersistentClient(path="Databases/.chroma")
reg_collection = client.get_or_create_collection(name="regulatory_clauses")
prec_collection = client.get_or_create_collection(name="precedent_chunks")
```

- `PersistentClient`: Data survives process restarts (stored in `Databases/.chroma/`).
- `get_or_create_collection`: Idempotent — safe to re-run ingestion pipeline.

### Upsert Logic
```python
collection.upsert(
    ids=ids,
    documents=documents,       # Raw text (stored for inspection)
    metadatas=clean_metadatas, # Filtered to basic Python types only
    embeddings=dense_vecs      # 1024-dim float lists
)
```

Note: ChromaDB metadata values must be `str | int | float | bool`. Lists are converted to comma-separated strings. `None` values are dropped entirely.

### Sparse Index
ChromaDB's Python client does not officially expose a sparse vector storage API in its standard `Collection.add()`. The sparse vectors are stored in a fallback JSON file:

```python
# After each upsert batch:
for i, doc_id in enumerate(ids):
    self.fallback_sparse_index[doc_id] = sparse_vecs[i]
self._save_fallback_sparse()  # Writes to Databases/.chroma/fallback_sparse.json
```

---

## Batch Processing & Memory Management

The `index_chunks()` function in `master_ingestion_runner.py` processes in batches of 32 (default) to prevent OOM errors:

```python
for i in range(0, len(nodes), batch_size):
    batch = nodes[i:i+batch_size]
    vectors = embedder.embed_chunks([n["text"] for n in batch])
    vector_store.add_chunks(...)
    del vectors
    gc.collect()  # Explicit GC between batches
```

The explicit `gc.collect()` after each batch prevents tensor accumulation on the GPU memory heap (relevant on both MPS and CUDA backends, and prevents fragmentation on CPU).

---

## Re-running the Pipeline

To re-parse PDFs from scratch:
```bash
python scripts/reparse.py
```

To re-index without re-parsing (if only embedder changed):
```bash
# Clear ChromaDB collections first
python -c "import chromadb; c = chromadb.PersistentClient('Databases/.chroma'); c.delete_collection('regulatory_clauses'); c.delete_collection('precedent_chunks')"
# Then run ingestion
python -m src.ingestion.runners.master_ingestion_runner
```

To test with limited pages (faster):
```python
# In master_ingestion_runner.py __main__ block:
reg_chunks, prec_chunks = process_pdfs(max_pages=5)
```
