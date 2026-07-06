# 🚀 Phase 2 Progress & Engineering Checkpoint
**Date:** July 6, 2026
**Project:** SEBI PS04 - SME IPO Offer Document Generator

## 📊 Progress Summary
- **Phase 0 (Foundation)**: Completed (Schema & API Wizard).
- **Phase 1 (Corpus Acquisition & Parsing)**: Completed (PDF routing & yield checks).
- **Phase 2 (Upgraded Hierarchical Chunking Strategy)**: Completed. Successfully built the 3-tier chunking architecture required for Small-to-Big Retrieval and Contextual Enrichment, laying the groundwork for high-fidelity retrieval in Phase 3. 

---

## 🛠️ Features Built & Tested

1. **Context Enricher (`src/ingestion/context_enricher.py`)**
   - Built a dynamic context-prepending engine that extracts metadata (Company, Exchange, Section, Chapter, Regulation) and injects it directly into the raw text of a child chunk.
   
2. **SQLite Parent Document Store (`src/retrieval/parent_doc_store.py`)**
   - Built a relational key-value store in SQLite mapped as `child_id` -> `parent_text`. 
   - Exposes the `expand_to_parent()` method for downstream retrieval augmentation.

3. **Precedent Chunker (`src/ingestion/precedent_chunker.py`)**
   - Implemented `HybridChunker` from IBM's `docling` library to parse highly complex DRHP documents, respecting native document structure and enforcing a strict 512-token limit (aligned with BGE-M3 limits).

4. **Regulatory Chunker (`src/ingestion/regulatory_chunker.py`)**
   - Engineered a custom hierarchical parser that segments SEBI's ICDR legal text into a 3-tier tree: Chapter ➡️ Regulation ➡️ Sub-regulation (Leaf).

5. **Comprehensive Test Suite (`tests/test_phase_2_chunking.py`)**
   - Ensured all Go/No-Go conditions were met, including asserting proper parent-child expansion, accurate breadcrumb injection, and proper output folder isolation. 

---

## 🏗️ Engineering Decisions (Phase 2)

### 1. Small-to-Big Chunking Architecture (SQLite)
- **Decision:** We elected to use a dual-storage retrieval strategy. ChromaDB will only index the small "leaf" chunks (~200 to 500 tokens), while SQLite will store the heavy "parent" sections (~3,000 to 5,000 tokens).
- **Rationale:** If we indexed entire 3,000-token sections directly into the vector database, the semantic density would be heavily diluted, leading to terrible retrieval accuracy. Conversely, if we fed the LLM a 200-token leaf chunk without its surrounding text, the AI would lack boundary context and hallucinate. By indexing small for high precision and retrieving big for high context, we solve both issues simultaneously.

### 2. Contextual Enrichment Injection (Anthropic Method)
- **Decision:** Every child chunk now physically contains its structural path prepended to its text, e.g., `[Context: Chapter IX > Regulation 229:] The issuer has operating profit...`
- **Rationale:** A chunk that simply says "The issuer has operating profit" is completely ambiguous to a vector database. By hardcoding the semantic breadcrumb into the text *before* it is embedded, the vector model (BGE-M3) natively understands the chunk's exact legal and structural location without needing complex metadata filtering logic at query time.

### 3. BGE-M3 Tokenizer Alignment
- **Decision:** Configured Docling's `HybridChunker` to use the `BAAI/bge-m3` tokenizer explicitly, enforcing a hard `max_tokens=512` limit on the child chunks.
- **Rationale:** Different models tokenize text differently. If we chunked the text using a generic tokenizer (like OpenAI's `tiktoken`), the resulting chunk might exceed BGE-M3's strict dense context limits during Phase 3, leading to catastrophic indexing crashes.

---
*Phase 2 is fully complete. The data pipelines are primed. Ready to commence Phase 3 (BGE-M3 Triple-Mode Indexing).*
