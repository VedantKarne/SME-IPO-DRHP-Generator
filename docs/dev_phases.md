# 📈 Development Phase Log

> **Complete engineering log across all 16 development phases** — decisions, challenges, resolutions, and key technical achievements.

---

## Phase 0 — Foundation: Database Schema & Wizard API

**Goal**: Establish the relational data model and intake APIs before any AI components.

### Built
- SQLAlchemy ORM with 6 core tables: `Company`, `FinancialStatement`, `DirectorKMP`, `OfferDetails`, `GeneratedSection`, `ChatMessage`
- FastAPI Wizard API (`/api/wizard/*`): 4 endpoints for company/financials/directors/offer data
- Pydantic schemas for all request/response bodies
- Full pytest test coverage for all wizard endpoints

### Key Decision: Relational DB over NoSQL
- **Choice**: SQLite + SQLAlchemy instead of MongoDB
- **Rationale**: The eligibility engine needs to run precise arithmetic (EBITDA thresholds, capital limits) against financial data. A rigid schema prevents malformed inputs from breaking downstream LLM generation. Relational integrity also simplifies cross-table queries in `get_company_data()`.

### Key Decision: Backend Financial Arithmetic
- `total_issue_size_lakhs = (total_shares × price) / 100,000` is calculated server-side
- **Rationale**: Financial figures that appear in the DRHP must be mathematically consistent across all sections. Frontend-computed values are unreliable.

---

## Phase 1 — Document Ingestion Pipeline

**Goal**: Build the PDF-to-chunk pipeline for regulatory and precedent documents.

### Built
- `pdf_parser.py`: Dual-engine parsing (PyMuPDF for text, Docling for layout)
- `regulatory_chunker.py`: ICDR-aware chunking on chapter/regulation boundaries
- `precedent_chunker.py`: DRHP section-aware chunking via Docling `HybridChunker`
- `context_enricher.py`: Breadcrumb injection into regulatory chunks
- Intermediate JSONL caching in `Parsed_Docs/` and `Chunked_Docs/`

### Challenge: Docling Layout Analysis Speed
- **Problem**: Docling's `DocumentConverter` is very slow for large PDFs (10+ min per file)
- **Resolution**: JSONL caching — once parsed, files are never re-parsed. Subsequent ingestion runs load from cache.

---

## Phase 2 — Embeddings & Vector Store

**Goal**: Embed all chunks and build the ChromaDB vector knowledge base.

### Built
- `bge_m3_embedder.py`: `BGEM3FlagModel` with `use_fp16=True`, `max_length=8192`
- `vector_store.py`: ChromaDB `PersistentClient` with two collections
- `fallback_sparse.json`: BGE-M3 sparse lexical weights stored outside ChromaDB
- Batch embedding with explicit `gc.collect()` for GPU memory stability (MPS on Apple Silicon, CUDA on NVIDIA)

### Key Decision: Separate Sparse JSON Store
- **Problem**: ChromaDB's Python API doesn't expose sparse vector storage in `Collection.add()`
- **Solution**: Store sparse weights in `fallback_sparse.json`, queried by inner product at retrieval time
- **Trade-off**: Slower than native ChromaDB sparse search but 100% stable (vs. experimental chromadb.sparse APIs)

### Key Decision: BGE-M3 over Separate Dense+Sparse Models
- Running one `BGEM3FlagModel` generates both dense and sparse vectors in a single forward pass
- **Benefit**: Halves embedding time vs. running two separate models (e.g., sentence-transformers for dense + BM25 for sparse)

---

## Phase 3 — RAPTOR Hierarchical Indexing

**Goal**: Build a 3-level summary tree over the regulatory corpus for thematic retrieval.

### Built
- `raptor.py`: Groq-powered recursive summarisation
- Level 2 (clause groups) → Level 1 (thematic categories) → Root (full regulatory summary)
- RAPTOR nodes injected into `regulatory_clauses` ChromaDB collection with `chunk_level` metadata

### Key Decision: RAPTOR Only for Regulatory Corpus
- Precedent DRHPs already have natural section structure — RAPTOR summaries would be redundant
- Regulatory text benefits from hierarchical understanding (e.g., "What are general SME listing requirements?" needs root-level context, not just clause-level hits)

---

## Phase 4 — SEBI ICDR Eligibility Engine

**Goal**: Automated, auditable eligibility check before drafting begins.

### Built
- `src/eligibility/checker.py`: `EligibilityEngine` class with 5 hard checks
- `src/api/eligibility_router.py`: `GET /api/eligibility/{company_id}`
- `CheckResult` and `EligibilityReport` Pydantic models
- Full test suite for all 5 checks (pass and fail scenarios)

### Key Decision: Deterministic Check Engine (No LLM)
- Eligibility is a binary, legally binding determination — not suitable for probabilistic LLM inference
- All checks are pure Python arithmetic and boolean logic, making them fully auditable and reproducible

---

## Phase 4.5 — Hybrid Retrieval Engine

**Goal**: Build the dual-branch search with RRF fusion, parent expansion, and FlashRank reranking.

### Built
- `hybrid_retriever.py`: `HybridRetriever` class with `hybrid_retrieve()` method
- `hybrid_search.py`: Lower-level search utilities
- `parent_doc_store.py`: SQLite parent chunk store + expansion
- `flashrank_reranker.py`: FlashRank ONNX cross-encoder wrapper
- `router.py`: Query type classifier

### Key Decision: 3× Candidate Buffer for Reranker
- Retrieve `k×3` candidates from each corpus, then rerank to top-k
- **Rationale**: Cross-encoders work best with a rich candidate pool — reranking 5 from 5 provides no benefit

### Key Decision: Query-Type Adaptive RRF Weights
- Compliance queries: sparse-heavy (0.35 dense / 0.65 sparse) — exact regulatory terminology matters
- Precedent queries: dense-heavy (0.65/0.35) — semantic similarity across different company names/styles

---

## Phase 5 — LangGraph Agentic Orchestrator

**Goal**: Build the multi-node agent that drafts DRHP sections end-to-end.

### Built
- `orchestrator.py`: LangGraph `StateGraph` with 7 nodes + `MemorySaver` checkpointing
- `AgentState` TypedDict with full state schema
- Parallel fan-out from START to 3 retrieval nodes
- Self-correction loop (max 2 revisions) via conditional edges
- HITL `interrupt()` / `Command(resume=...)` pattern

### Challenge: LangGraph HITL Exception Handling
- **Problem**: `interrupt()` raises `GraphInterrupt` exception — initially confused with a real error
- **Resolution**: Wrapping `graph.invoke()` in `try/except` in `server.py` to catch `GraphInterrupt`, then using `graph.get_state()` to extract the draft before the interrupt

### Key Decision: `MemorySaver` (in-memory) over SQLite Checkpointer
- For the hackathon demo, in-memory checkpoints are sufficient
- **Trade-off**: State lost on server restart; acceptable for demo, would need `SqliteSaver` in production

---

## Phase 6 — API Layer Expansion

**Goal**: Build all HITL review endpoints beyond the core agent run.

### Built
- `chat_edit_router.py`: `POST /api/sections/{id}/chat` — Groq-powered NL edits
- `locking_router.py`: `POST /api/sections/{id}/approve` — section certification
- `impact_router.py`: `GET /api/impact/{field}` — deterministic ripple map
- `copilot_router.py`: `POST /api/copilot/ask` — Nirmaan regulatory Q&A
- `hitl_server.py`: LangGraph interrupt/resume endpoints

### Key Decision: Deterministic Impact Map
- The `impact_router.py` uses a hardcoded lookup table (e.g., `ebitda → [Capital Structure, Financial Statements, MD&A]`)
- **Rationale**: An LLM-based impact analysis would be slow and potentially inconsistent. For the demo, a curated map is more reliable and faster.

---

## Phase 7 — React Frontend

**Goal**: Build all 6 screens of the Nirmaan AI UI.

### Built
- Landing interview screen (`Landing.jsx`)
- Dashboard with animated score rings (`Dashboard.jsx`)
- 25-section workspace with editor + AI chat (`Workspace.jsx`)
- SEBI eligibility report screen (`Eligibility.jsx`)
- Document upload simulation (`Documents.jsx`)
- Merchant Banker review portal (`Review.jsx`)
- AppShell navigation (`AppShell.jsx`)
- Complete CSS design system with glassmorphism + micro-animations (`index.css`)

### Key Decision: No State Management Library
- All state in `App.jsx` as `useState`, passed as props
- **Rationale**: For a focused demo with 6 screens, Context API or Zustand would add complexity without meaningful benefit

---

## Phase 8 — Prompt Engineering

**Goal**: Design anti-hallucination prompts that produce consistently compliant DRHP drafts.

### Built
- `DRAFT_SECTION_SYSTEM_PROMPT` in `prompts.py`: Full drafting instructions with citation rules
- `AGENT_SYNTHESIS_PROMPT`: Second-layer prompt for multi-section coherence
- Self-correction injection: Gap list appended to prompt on revision attempts
- Human feedback injection: Feedback appended to prompt on HITL resume

### Key Decision: Explicit GAP Markers over Silence
- LLMs tend to either hallucinate missing data or silently skip requirements
- **Solution**: Instruct the model to explicitly write `⚠️ GAP: [description]` for any missing information
- **Benefit**: The draft becomes an auditable checklist — promoters know exactly what to provide

---

## Phase 9 — Gap Detection & Completeness Scoring

**Goal**: Scan drafts for missing information and produce an actionable gap list.

### Built
- `gap_detector.py`: `flag_gaps()` with two regex patterns (explicit GAP markers + bracketed placeholders)
- Completeness score: `max(0.0, 1.0 - 0.1 × n_gaps)`
- `explain_gap_to_promoter()`: Groq-powered plain-English gap translation

### Challenge: LLM Output Formatting Inconsistency
- **Problem**: Llama 3.3-70B sometimes writes `⚠️ GAP: [Broker name, address]` (comma-separated multi-gap) vs. multiple separate `⚠️ GAP:` markers
- **Resolution**: Pattern1 stops at comma (`,`) to avoid swallowing multiple gaps in one match; Pattern2 ignores brackets containing `|` (citations use this character, gap placeholders don't)

---

## Phase 10 — Document Assembly

**Goal**: Stitch all approved sections into a final DRHP document.

### Built
- `document_assembler.py`: `document_assembler_node()` with SEBI TOC ordering
- `build_docx()`: python-docx `.docx` export with section headings + citation footnotes
- `build_pdf()`: ReportLab PDF export
- Export to `exports/DRHP_{company_id}.docx` and `.pdf`

### Key Decision: SEBI TOC Order
- Sections must appear in the legally mandated SEBI DRHP Table of Contents order
- A hardcoded `SEBI_TOC_ORDER` dict maps section names to position numbers
- `sort_by_sebi_toc()` sorts the ORM objects before export

---

## Phase 11 — Nirmaan Copilot

**Goal**: Build a RAG-grounded regulatory Q&A assistant for the workspace.

### Built
- `copilot_router.py`: `POST /api/copilot/ask` with Groq + both corpora RAG
- Custom Copilot system prompt: Confident consultant persona, no "based on the context provided" phrases
- Citation extraction from response text (`[Reg X | ICDR 2018]` pattern matching)

---

## Phase 12 — PDF KPI Extraction

**Goal**: Allow promoters to upload financial PDFs for automatic data extraction.

### Built
- `kpi_extractor.py`: Gemini 2.5 Flash structured output via `google-generativeai`
- `ExtractionResult` Pydantic model for structured JSON output
- `tenacity` retry logic for `ResourceExhausted` (quota) errors
- `POST /api/upload` endpoint

### Key Decision: Gemini for PDF Extraction (not Groq)
- Groq's Llama model doesn't natively support PDF input
- Gemini 2.5 Flash supports multimodal input (text + images/PDFs) with high-quality structured JSON output
- **Trade-off**: Adds a second LLM provider dependency (Groq + Gemini) — acceptable for this specific use case

---

## Phase 13 — Demo Flow & Onboarding

**Goal**: Build the polished demo flow for the hackathon presentation.

### Built
- `POST /api/demo/init` endpoint: Upserts a demo company from interview answers
- Dynamic litigation flag based on keyword analysis of user's answer
- Landing interview state machine with typing simulation and eligibility animation

### Key Decision: Interview → DB Pipeline
- The interview answers directly update the company database (not just a visual simulation)
- **Benefit**: When the demo navigates to the workspace, the company name, industry, and litigation status are real data that affect agent behavior and eligibility results

---

## Phase 14 — UI Interactivity

**Goal**: Transform static visual prototype into a tactile interactive product.

### Built
- Version History: Wired to React state — V1 = half text, V2 = formal version, V3 = current
- Document Uploads: Hidden `<input type="file">`, setTimeout delays, "Uploading..." states
- Banker Review Actions: Inline comment textarea, state-driven Kanban column transitions

---

## Phase 15 — Final Polish & Bug Fixes

**Goal**: Fix all UX issues discovered during demo rehearsal.

### Built / Fixed
- **Gap UI Formatting**: Rewrote gap extraction regex to prevent swallowing multi-gap sentences
- **Useless Gap Titles**: Added intelligent title/context splitting at first comma for long gap strings
- **Static Demo Screens**: All interactive buttons now perform meaningful state transitions
- **Banker Rejection Workflow**: Simulated "Returned to Issuer" state without backend API calls

### Challenge: Gap Text Too Long for UI Cards
- **Problem**: LLM occasionally writes `⚠️ GAP: [Broker name, address, phone number, SEBI registration]` — one gap string covering multiple missing fields
- **Resolution**: `Workspace.jsx` splits at first period (if within 80 chars) or first comma (if title > 50 chars) to extract a short `title` and a longer `context` for the card display

---

## Lessons Learned

1. **Sparse vector storage in ChromaDB requires workarounds** — the fallback JSON approach is production-safe and transparent.
2. **LLM output formatting must be treated as unreliable** — multiple regex patterns covering different output styles are more robust than a single strict pattern.
3. **HITL in LangGraph requires exception handling awareness** — `interrupt()` is an exception at the Python level, not a return value.
4. **BGE-M3 singleton loading is critical** — loading the model once at startup vs. per-request reduces latency from ~30s to ~50ms per query.
5. **`gc.collect()` between embedding batches prevents GPU memory OOM** — empirically necessary on both Apple Silicon MPS and NVIDIA CUDA. Not documented in PyTorch guides but prevents tensor accumulation across batches.
6. **Demo interactivity > Feature completeness** — animated score rings, typing indicators, and interactive bankers create more impact than an additional DRHP section generator that runs correctly but looks boring.
