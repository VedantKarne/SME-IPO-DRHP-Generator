# 📐 Architecture Deep-Dive

> **Full system design for the Nirmaan AI SME IPO DRHP Generator** — 5 operational phases, component interactions, data flows, and key design decisions.

---

## Overview

Nirmaan AI is built as five sequential operational phases, each representing a discrete stage in the SME IPO DRHP preparation lifecycle:

| Phase | Name | What Happens |
|---|---|---|
| **Phase 0** | Offline Ingestion | PDFs are parsed, chunked, RAPTOR-indexed, embedded, and loaded into ChromaDB |
| **Phase 1** | Guided Data Capture | SME promoter fills company data via Nirmaan AI interview + Wizard API |
| **Phase 2** | Eligibility Check | SEBI ICDR rules are applied to company financials and directors |
| **Phase 3** | Agentic Drafting | LangGraph 7-node agent drafts each DRHP section with RAG + self-correction |
| **Phase 4** | HITL Review Workspace | Promoter resolves gaps; Merchant Banker certifies sections |
| **Phase 5** | Assembly & Export | All certified sections assembled into final DRHP `.docx` + `.pdf` |

---

## Phase 0 — Offline Ingestion Pipeline

**Run once before the demo.** This phase processes the raw PDF corpus and builds the knowledge base.

### Input: `Original_Docs/`
- `Regulatory/` — SEBI ICDR 2018 Regulations PDF(s)
- `Precedents/` — Real DRHP filings (filename convention: `Company_Exchange_Year.pdf`)

### Step 1: PDF Parsing (`src/ingestion/pdf_parser.py`)
- **PyMuPDF (`fitz`)**: Extracts raw text page-by-page with page-level metadata.
- **Docling `DocumentConverter`**: Applies layout understanding — identifies headings, table structures, section boundaries.
- Output: `ParsedDocument` Pydantic models, cached as JSONL in `Parsed_Docs/`.

### Step 2: Chunking

**Regulatory Chunking** (`src/ingestion/regulatory_chunker.py`):
- Splits ICDR text on chapter and regulation number boundaries.
- Injects "breadcrumb" context (e.g., "Part II > Chapter IV > Reg 229") into each chunk via `context_enricher.py`.
- Preserves regulatory citation IDs (e.g., `ICDR_2018_Reg229_2_a`) as chunk metadata.
- Output: `RegulatoryChunk` objects, cached in `Chunked_Docs/regulatory/`.

**Precedent Chunking** (`src/ingestion/precedent_chunker.py`):
- Uses Docling's `HybridChunker` for structure-aware chunking of DRHP filings.
- Creates section-aware chunks with metadata: `company`, `exchange`, `year`, `section`.
- Builds a parent-child chunk hierarchy: short child chunks (for precision) linked to full parent passages (for context richness).
- Output: `PrecedentChunk` objects, cached in `Chunked_Docs/precedent/`.

### Step 3: RAPTOR Summary Tree (`src/retrieval/raptor.py`)

For the **regulatory corpus only**, a RAPTOR-lite hierarchical summary tree is built:

```
Root Node (full regulatory summary)
├── Level-1 Node: "Core Regulations" theme summary
│   ├── Level-2 Node: "SME Listing Requirements" category summary  
│   │   ├── Leaf: Reg 229(1) clause text
│   │   ├── Leaf: Reg 229(2) clause text
│   │   └── ...
│   └── Level-2 Node: "Disclosure Requirements" category summary
│       └── ...
```

Each summary node is generated via Groq `llama-3.3-70b-versatile` with a legal summarization prompt. This enables the retrieval system to answer both leaf-level ("what does Reg 229(2)(a) say?") and root-level ("what are SME listing requirements generally?") queries with equal accuracy.

### Step 4: BGE-M3 Embedding (`src/retrieval/bge_m3_embedder.py`)

`BAAI/bge-m3` (via `FlagEmbedding.BGEM3FlagModel`) generates **two vector types per chunk**:

- **Dense vectors**: 1024-dimensional semantic embeddings (captured by `return_dense=True`).
- **Sparse lexical weights**: Token-level importance scores (captured by `return_sparse=True`). These are stored separately in `fallback_sparse.json` since ChromaDB doesn't yet natively support sparse vectors in its standard Python API.

Hardware acceleration is **automatic** — PyTorch selects the best available backend at runtime:
- **macOS (Apple Silicon)**: MPS via PyTorch Metal (`use_fp16=True` halves memory with negligible accuracy loss, works natively on MPS)
- **Windows / Linux with NVIDIA GPU**: CUDA — requires `pip install torch --index-url https://download.pytorch.org/whl/cu121` (or cu118)
- **CPU fallback**: Fully functional on any platform; `use_fp16=True` is silently cast to `float32` where not natively supported

### Step 5: ChromaDB Indexing (`src/retrieval/vector_store.py`)

Two `PersistentClient` collections are maintained:

| Collection | Contents |
|---|---|
| `regulatory_clauses` | All ICDR clause chunks + RAPTOR summary nodes |
| `precedent_chunks` | All DRHP precedent child chunks |

Dense vectors are stored natively in ChromaDB. Sparse vectors are stored in `Databases/.chroma/fallback_sparse.json` (a flat JSON dictionary: `{chunk_id: {token: weight}}`).

The parent chunk text is stored in a separate SQLite database (`Databases/parent_doc_store.db`) managed by `src/retrieval/parent_doc_store.py`.

---

## Phase 1 — Guided Data Capture

### Frontend Onboarding (`frontend/src/screens/Landing.jsx`)

A scripted conversational interview ("Nirmaan AI") collects 5 key data points:
1. Company name
2. Industry / business description
3. Years of operation
4. Annual revenue (FY 2024 approx.)
5. Pending litigations against directors/KMPs

The interview uses a state machine (`INTERVIEW_SCRIPT` array) with simulated typing delays for a natural conversational feel. At step 5, an animated eligibility check runs live.

After the interview, `POST /api/demo/init` updates the seeded demo company in the database to reflect the user's actual answers — making the workspace personalized to their input.

### Wizard API (`src/api/wizard.py`, router prefix: `/api/wizard`)

For structured data entry (or direct API calls), four endpoints handle the data:

| Endpoint | Pydantic Schema | Data Captured |
|---|---|---|
| `POST /api/wizard/company` | `CompanyCreate` | CIN, name, incorporation date, registered office, NIC code |
| `POST /api/wizard/financials/{company_id}` | `List[FinancialStatementCreate]` | 3-year Revenue, EBITDA, PAT, Net Worth, Paid-up Capital |
| `POST /api/wizard/directors/{company_id}` | `List[DirectorCreate]` | Director name, DIN, designation, litigation status |
| `POST /api/wizard/offer/{company_id}` | `OfferCreate` | Shares offered, price per share, objects of offer |

All data is written to `test_wizard.db` via SQLAlchemy ORM.

### PDF-Based KPI Extraction (`src/extraction/kpi_extractor.py`)

If the promoter uploads an existing financial PDF (e.g., annual report), Gemini 2.5 Flash extracts structured financial KPIs via a multimodal prompt. The `ExtractionResult` Pydantic model is used for structured output, with `tenacity` exponential backoff for `ResourceExhausted` (quota) errors.

---

## Phase 2 — SEBI ICDR Eligibility Engine

**File**: `src/eligibility/checker.py`  
**Endpoint**: `GET /api/eligibility/{company_id}`

The `EligibilityEngine` class performs 5 hard checks against SEBI ICDR 2018:

```python
class EligibilityEngine:
    def check_all(self, company_id: str) -> EligibilityReport:
        # Queries: Company + FinancialStatement + DirectorKMP + OfferDetails
        checks = [
            self._check_ebitda(financials),        # Reg 229(2)(a)
            self._check_net_worth(financials),      # Reg 229(1)(b)
            self._check_paid_up_capital(...),       # Reg 229(3)
            self._check_kmp_litigation(directors),  # Mar-2025 Amendment
            self._check_no_winding_up(company)     # Reg 229(1)(c)
        ]
        eligible = all(c.passed for c in checks if c.mandatory)
```

Each check returns a `CheckResult` (Pydantic model) with:
- `name`: Human-readable check name
- `passed`: Boolean result
- `mandatory`: Whether failure blocks IPO eligibility
- `clause_id`: ICDR regulation citation ID (e.g., `ICDR_2018_Reg229_2_a`)
- `reason`: Plain-English explanation

The overall `EligibilityReport` is returned as JSON.

---

## Phase 3 — LangGraph Agentic Drafting

**Entrypoint**: `POST /api/agent/run` → `src/api/server.py` → `src/agent/orchestrator.py`

### AgentState (TypedDict)

```python
class AgentState(TypedDict):
    company_name: str
    current_section: str
    regulatory_context: str   # Output from regulatory_retrieval node
    precedent_context: str    # Output from precedent_retrieval node
    company_facts: str        # Output from data_fetch node
    consistency_errors: List[Dict]
    draft_text: str
    human_feedback: str
    status: str               # 'draft' | 'promoter_reviewed' | 'intermediary_certified'
    completeness_score: float
    revisions: int
    gaps: List[Dict]
```

### Graph Topology

```
START
  │
  ├──► regulatory_retrieval ──┐
  ├──► precedent_retrieval  ──┤ (parallel fan-out)
  └──► data_fetch           ──┘
                              │
                              ▼
                    consistency_validator
                              │
                              ▼
                      draft_generation ◄──────────────┐
                              │                        │
                              ▼                        │ (if score < 0.75
                        gap_validator                  │  and revisions < 2)
                              │                        │
                    self_correction_router ────────────┘
                              │
                    (if score ≥ 0.75 or revisions ≥ 2)
                              │
                              ▼
                        hitl_review ──► END
```

The parallel fan-out (`START → regulatory_retrieval`, `START → precedent_retrieval`, `START → data_fetch`) runs all three retrieval nodes concurrently. LangGraph collects all three outputs before proceeding to `consistency_validator`.

### HITL Interrupt/Resume

The `hitl_review` node calls LangGraph's `interrupt(payload)`, which:
1. Pauses graph execution at a checkpoint (saved by `MemorySaver`).
2. Returns the current state to the API caller (`server.py`).
3. Waits until the API caller invokes `graph.invoke(..., Command(resume=feedback))`.

This implements a true Human-in-the-Loop pattern — the graph state is persisted between API calls.

---

## Phase 4 — Human Review Workspace

Four specialized FastAPI routers handle the HITL workspace:

| Router | Endpoint | Purpose |
|---|---|---|
| `chat_edit_router.py` | `POST /api/sections/{id}/chat` | Apply natural language edits via Groq |
| `locking_router.py` | `POST /api/sections/{id}/approve` | Lock section (`is_locked=True`) |
| `impact_router.py` | `GET /api/impact/{field}` | Deterministic field ripple map |
| `copilot_router.py` | `POST /api/copilot/ask` | RAG-grounded regulatory Q&A |

### Nirmaan Copilot Architecture

The Copilot (`src/api/copilot_router.py`) is NOT a general-purpose chatbot. It is specifically tuned to:
1. Retrieve relevant regulatory context (always from both corpora, `k=3`).
2. Inject context as citation material only (not sole source of truth).
3. Answer confidently from combined LLM knowledge + retrieved citations.
4. Return extracted inline citations as a structured array.

The system prompt enforces a "confident consultant" tone — never saying "based on the context provided."

---

## Phase 5 — Document Assembly & Export

**File**: `src/agent/document_assembler.py`

### SEBI TOC Ordering

All 25 DRHP sections are assigned a canonical position from the SEBI table of contents:

```python
SEBI_TOC_ORDER = {
    "Cover Page & General Information": 1,
    "Risk Factors": 2,
    ...
    "Declaration & Undertakings": 25
}
```

`sort_by_sebi_toc()` sorts all `GeneratedSection` ORM objects by their TOC position.

### Export Formats

- **DOCX** (`build_docx()`): Uses `python-docx` — each section becomes a `Heading 1` with full `draft_text` and regulatory citation footnotes.
- **PDF** (`build_pdf()`): Uses `ReportLab`'s `SimpleDocTemplate` — renders sections with `Heading1` and `Normal` paragraph styles.

---

## Key Design Decisions

### 1. SQLite over MongoDB
Structured relational tables (`Company`, `FinancialStatement`, `DirectorKMP`) allow the eligibility engine to run precise arithmetic (EBITDA thresholds, capital limits) and the gap detector to cross-reference specific named fields. A JSON blob would not support this.

### 2. BGE-M3 over Simpler Embeddings
BGE-M3's simultaneous dense + sparse output means we run the model once and get both semantic and lexical representations — halving the embedding cost vs. running two separate models.

### 3. Separate Regulatory & Precedent Collections
Compliance queries ("what does SEBI require?") and precedent queries ("show me how others drafted this") have fundamentally different retrieval characteristics. Separate ChromaDB collections with per-collection weight tuning (compliance = sparse-heavy, precedent = dense-heavy) outperform a single merged collection.

### 4. RAPTOR Only for Regulatory Corpus
Precedent DRHPs are already well-structured (section-by-section). RAPTOR summaries add value for the regulatory corpus, which is a dense legal document where section-level thematic understanding is needed. Building RAPTOR for precedents would be redundant.

### 5. LangGraph over Direct Function Calls
The `MemorySaver` checkpointer allows mid-graph state persistence for HITL. Without LangGraph, implementing interrupt/resume would require manual state serialization. LangGraph also provides built-in parallel node execution (fan-out from START).

---

## Data Store Summary

| Store | Location | Contents |
|---|---|---|
| `test_wizard.db` | Project root | Main company database (wizard inputs + generated sections) |
| `Databases/parent_doc_store.db` | `Databases/` | Parent chunk text for expansion |
| `Databases/.chroma/` | `Databases/` | ChromaDB: `regulatory_clauses` + `precedent_chunks` collections |
| `Databases/.chroma/fallback_sparse.json` | `Databases/.chroma/` | Sparse lexical weight vectors |

---

## LLM Routing Summary

| Task | Model | File | Rationale |
|---|---|---|---|
| DRHP Section Drafting | Groq `llama-3.3-70b-versatile` | `orchestrator.py` | Speed (~500 tok/s) + 4K token output for long legal text |
| Chat-Based Section Editing | Groq `llama-3.3-70b-versatile` | `chat_edit_router.py` | Low latency for interactive UI |
| Nirmaan Copilot Q&A | Groq `llama-3.3-70b-versatile` | `copilot_router.py` | Real-time regulatory Q&A |
| RAPTOR Summarisation | Groq `llama-3.3-70b-versatile` | `raptor.py` | Offline batch — accuracy over speed |
| PDF Financial Extraction | Gemini 2.5 Flash | `kpi_extractor.py` | Multimodal: handles tables, images, scanned PDFs |

> **Correction vs. early planning docs**: Gemini is used **only** for PDF extraction. All drafting, editing, copilot, and RAPTOR summarisation is handled by Groq. The eligibility check and gap detection are pure deterministic Python logic — no LLM involved.
