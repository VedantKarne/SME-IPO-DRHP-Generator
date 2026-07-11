# 🚀 Setup & Deployment Guide

> **Step-by-step installation, configuration, and deployment instructions** — covering macOS (Apple Silicon MPS), Windows/Linux (NVIDIA CUDA), and CPU-only setups.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.10+ | 3.10–3.12 tested |
| Node.js | 20+ | For frontend build |
| npm | 9+ | Comes with Node.js |
| Groq API Key | Free tier | [console.groq.com](https://console.groq.com/) |
| Google AI Studio Key | Free tier | [aistudio.google.com](https://aistudio.google.com/) |

### Hardware Acceleration (Optional but Recommended)

The embedding and reranking pipeline supports three hardware targets. All are detected **automatically** by PyTorch/ONNX Runtime — no code changes needed:

| Platform | Hardware | Accelerator | Speedup vs CPU |
|---|---|---|---|
| **macOS (Apple Silicon)** | M1 / M2 / M3 / M4 / M5 | PyTorch MPS (Metal Performance Shaders) + CoreML/ANE (ONNX Runtime) | ~4–8× |
| **Windows / Linux** | NVIDIA GPU (GTX 10xx+, RTX series) | PyTorch CUDA + ONNX Runtime CUDA EP | ~6–15× |
| **Any platform** | CPU only | PyTorch CPU + ONNX Runtime CPU EP | 1× (baseline) |

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd SME-IPO-DRHP-Generator
```

### 2. Create the `.env` file

```bash
# Copy example and fill in your keys
cat > .env << 'EOF'
GROQ_API_KEY=gsk_your_groq_api_key_here
GEMINI_API_KEY=your_google_ai_studio_key_here
EOF
```

**Where to get keys:**
- **Groq**: [console.groq.com](https://console.groq.com/) → Create API Key → Free tier includes access to `llama-3.3-70b-versatile`
- **Gemini**: [aistudio.google.com](https://aistudio.google.com/) → API Keys → Create API Key → Free tier includes Gemini 2.5 Flash

### 3. Create a Python Virtual Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

> **Important**: Always activate the venv before running any Python commands.

### 4. Install Python Dependencies

**The base `requirements.txt` installs the CPU-compatible torch wheel (works everywhere). For GPU acceleration, install the correct torch variant for your platform _before_ running the requirements file:**

#### macOS — Apple Silicon (MPS/Metal)
```bash
# Standard pip wheel already includes MPS backend — no special index needed
pip install --upgrade pip
pip install -r requirements.txt
```

#### Windows / Linux — NVIDIA GPU (CUDA 11.8)
```bash
pip install --upgrade pip
# Install CUDA-enabled torch FIRST, then the rest of the deps
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install -r requirements.txt
```

#### Windows / Linux — NVIDIA GPU (CUDA 12.1)
```bash
pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
```

#### Windows / Linux — CPU only (no GPU)
```bash
pip install --upgrade pip
pip install -r requirements.txt  # torch CPU wheel installed by default
```

> **Windows users**: Use `python` instead of `python3` and activate the venv with `.venv\Scripts\activate` instead of `source .venv/bin/activate`.

### 5. Verify Hardware Acceleration

Run this verification script after installation:

```bash
python3 -c "
import torch, onnxruntime as ort
print('--- PyTorch ---')
print('CUDA available  :', torch.cuda.is_available())         # NVIDIA GPU (Windows/Linux)
print('CUDA device     :', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A')
print('MPS  available  :', torch.backends.mps.is_available()) # Apple Silicon (macOS)
print('\n--- ONNX Runtime ---')
print('ORT providers   :', ort.get_available_providers())
"
```

**Expected output by platform:**

| Platform | CUDA available | MPS available | ORT providers |
|---|---|---|---|
| macOS Apple Silicon | False | **True** | `['CoreMLExecutionProvider', 'CPUExecutionProvider']` |
| Windows/Linux NVIDIA | **True** | False | `['CUDAExecutionProvider', 'CPUExecutionProvider']` |
| CPU only | False | False | `['CPUExecutionProvider']` |

> **Note for Windows NVIDIA users:** If CUDA shows as unavailable despite having a GPU, verify your CUDA driver version matches the torch wheel (`cu118` requires CUDA driver ≥ 450.80, `cu121` requires ≥ 525.60). Check with: `nvidia-smi`

---

## Data Preparation (Required Before First Run)

### Document Directory Structure

```
SME-IPO-DRHP-Generator/
└── Original_Docs/
    ├── Regulatory/
    │   └── SEBI_ICDR_2018_Regulations.pdf   # (or any regulatory PDF)
    └── Precedents/
        ├── Company1_BSE_2023.pdf             # Real DRHP filings
        ├── Company2_NSE_2024.pdf
        └── ...
```

**Filename convention for precedents**: `CompanyName_Exchange_Year.pdf`
- `Exchange` should be `BSE` or `NSE`
- `Year` is the filing year (e.g., `2023`, `2024`)
- Example: `TechServ_BSE_2024.pdf`

> **Source for DRHPs**: Download from [BSE SME Platform](https://www.bsesme.com/) or [NSE Emerge](https://www.nseindia.com/market-data/sme-market) (publicly available).

### Run the Ingestion Pipeline

```bash
python -m src.ingestion.runners.master_ingestion_runner
```

**What happens:**
1. ✅ PDF parsing (PyMuPDF + Docling) — ~2–10 min depending on PDF count/size
2. ✅ Chunking (regulatory + precedent)
3. ✅ RAPTOR summary tree construction via Groq — requires API key
4. ✅ BGE-M3 embedding (MPS-accelerated) — ~5–20 min for 10+ PDFs
5. ✅ ChromaDB indexing
6. ✅ Sparse vector JSON dump

**Progress output:**
```
[INFO] Loading BGE-M3 model... (first run only, ~30s)
[INFO] Parsing 2 regulatory PDFs...
[INFO] Parsing 5 precedent DRHPs...
[INFO] Chunking complete: 847 regulatory chunks, 1243 precedent chunks
[INFO] Building RAPTOR tree (Level 2)...
[INFO] Embedding batch 1/89 (batch_size=12)...
[INFO] Indexing complete. regulatory_clauses: 910, precedent_chunks: 1243
```

### Seed the Demo Database

```bash
python scripts/start_demo.py
```

This creates a demo company ("AaravTech Solutions Pvt Ltd") with:
- 3 years of financial data
- 2 directors (1 with pending litigation for demo purposes)
- Offer details
- No pre-generated sections (these are generated live during demo)

---

## Starting the Application

### Backend (Terminal 1)

```bash
source .venv/bin/activate
uvicorn src.api.server:app --host 0.0.0.0 --port 8000 --reload
```

**Verify it's running:**
```bash
curl http://localhost:8000/health
# Response: {"status": "ok", "version": "1.0"}
```

Open Swagger UI: http://localhost:8000/docs

### Frontend (Terminal 2)

```bash
cd frontend
npm install          # First time only
npm run dev
```

**Access the app**: http://localhost:5173

---

## Directory Reference

| Directory | Contents | Gitignored? |
|---|---|---|
| `src/` | Python backend source code | No |
| `frontend/` | React frontend source code | No |
| `scripts/` | Utility scripts | No |
| `tests/` | Pytest test files | No |
| `docs/` | This documentation | No |
| `Dev_Phases_Progress/` | Phase checkpoint notes | No |
| `images/` | Screenshot assets | No |
| `Original_Docs/` | Raw PDFs (regulatory + precedents) | **Yes** (large files) |
| `Parsed_Docs/` | Intermediate JSONL cache | **Yes** |
| `Chunked_Docs/` | Chunked JSONL cache | **Yes** |
| `Databases/` | ChromaDB + SQLite stores | **Yes** |
| `exports/` | Generated DRHP DOCX/PDF files | **Yes** |
| `.venv/` | Python virtual environment | **Yes** |
| `.env` | API keys | **Yes** |

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | **Yes** | — | Groq API key for Llama 3.3-70B |
| `GEMINI_API_KEY` | For PDF upload only | — | Google AI Studio key for Gemini 2.5 Flash |
| `DATABASE_URL` | No | `sqlite:///test_wizard.db` | SQLAlchemy connection string |
| `CHROMA_DB_PATH` | No | `Databases/.chroma` | ChromaDB persistence directory |
| `SPARSE_INDEX_PATH` | No | `Databases/.chroma/fallback_sparse.json` | Sparse vector JSON file |

---

## Running Tests

```bash
source .venv/bin/activate
pytest tests/ -v
```

**Test files:**
- `tests/Phase_tests/test_phase_0_wizard_api.py` — Wizard API CRUD
- `tests/Phase_tests/test_phase_2_eligibility.py` — Eligibility engine
- `tests/Phase_tests/test_phase_4_retrieval.py` — Hybrid retrieval
- `tests/Phase_tests/test_phase_5_agent.py` — Agent orchestration
- `tests/manual_tests/` — Manual validation scripts

```bash
# Run a specific phase test
pytest tests/Phase_tests/test_phase_0_wizard_api.py -v

# Run with output capture disabled (see print statements)
pytest tests/ -v -s
```

---

## Troubleshooting

### `ModuleNotFoundError: No module named 'src'`

Run from the **project root directory**, not from within `src/`:
```bash
# Wrong:
cd src && python -m agent.orchestrator

# Correct:
cd SME-IPO-DRHP-Generator
python -m src.agent.orchestrator
```

Or set `PYTHONPATH`:
```bash
export PYTHONPATH=$PYTHONPATH:/path/to/SME-IPO-DRHP-Generator
```

### `chromadb.errors.ChromaError: Collection 'regulatory_clauses' already exists`

This is safe to ignore — `get_or_create_collection()` is idempotent. If you want a clean re-index:
```bash
rm -rf Databases/.chroma
python -m src.ingestion.runners.master_ingestion_runner
```

### `RateLimitError` from Groq

The `RateLimitAwareGroqClient` handles this automatically with exponential backoff. If you see repeated failures:
1. Wait 60 seconds (Groq rate limits reset per minute).
2. Check your Groq tier limits at [console.groq.com](https://console.groq.com/).
3. Consider reducing `max_tokens` in `orchestrator.py` → `draft_generation_node`.

### `MPS not available` (macOS Apple Silicon)

Ensure:
1. macOS 12.3 or later: `sw_vers -productVersion`
2. Using the standard PyPI torch wheel — **not** `--index-url https://download.pytorch.org/whl/cpu`
3. No conflicting conda environments overriding the venv

```bash
# Reinstall torch with the correct macOS wheel
pip uninstall torch && pip install torch
python3 -c "import torch; print(torch.backends.mps.is_available())"
```

---

### `CUDA not available` (Windows / Linux with NVIDIA GPU)

1. Check your NVIDIA driver: `nvidia-smi` — look for **CUDA Version** in the top-right.
2. Match the torch wheel to your CUDA version:
   - CUDA 11.x → use `--index-url https://download.pytorch.org/whl/cu118`
   - CUDA 12.x → use `--index-url https://download.pytorch.org/whl/cu121`
3. Reinstall torch with the correct index:
```bash
pip uninstall torch torchvision torchaudio -y
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
python3 -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```
4. If ONNX Runtime doesn't show `CUDAExecutionProvider`, install the CUDA-enabled ORT wheel:
```bash
pip uninstall onnxruntime -y
pip install onnxruntime-gpu   # Includes CUDA Execution Provider
python3 -c "import onnxruntime as ort; print(ort.get_available_providers())"
```

> **Note on FlashRank + CUDA EP**: FlashRank's ONNX model will automatically use `CUDAExecutionProvider` if `onnxruntime-gpu` is installed. This is transparent — no code changes needed.

### BGE-M3 first-run slow (30+ seconds)

Normal — the first run downloads and caches the `BAAI/bge-m3` model (~2.3 GB). Subsequent runs load from HuggingFace cache (~3–5 seconds).

### Frontend `CORS error`

Ensure the backend is running on port 8000 before starting the frontend. The FastAPI CORS middleware allows all origins in development (`allow_origins=["*"]`).

### SQLite locked errors

Only one process should write to `test_wizard.db` at a time. If you see `OperationalError: database is locked`, ensure no other Python process is holding the DB open.

---

## Resetting the Demo

To restart from a clean state:
```bash
# Remove the database
rm -f test_wizard.db Databases/app_state.db

# Re-seed demo
python scripts/start_demo.py

# Restart backend
uvicorn src.api.server:app --host 0.0.0.0 --port 8000 --reload
```

The vector database (`Databases/.chroma/`) is preserved — you only need to rebuild it if you add new PDFs or change the embedding model.
