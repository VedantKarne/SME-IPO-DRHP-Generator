#!/usr/bin/env zsh
# ─────────────────────────────────────────────────────────────────────────────
# run.sh — Nirmaan AI / SME-IPO-DRHP-Generator
# Starts the Python backend and React frontend in one command.
#
# Usage:
#   chmod +x run.sh
#   ./run.sh              # normal run
#   ./run.sh --seed       # run + re-seed demo DB before starting
#   ./run.sh --help       # show this help
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_DIR="$SCRIPT_DIR/.venv"
ENV_FILE="$SCRIPT_DIR/.env"

BACKEND_PORT=8000
FRONTEND_PORT=5173

SEED=false

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo "${CYAN}[INFO]${RESET}  $*"; }
success() { echo "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo "${RED}[ERROR]${RESET} $*" >&2; }

# ── Argument parsing ──────────────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --seed)  SEED=true ;;
    --help)
      grep '^#' "$0" | sed 's/^# \{0,2\}//'
      exit 0
      ;;
    *)
      error "Unknown argument: $arg  (use --help for usage)"
      exit 1
      ;;
  esac
done

# ── Cleanup on exit ───────────────────────────────────────────────────────────
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  info "Shutting down servers..."
  [[ -n "$BACKEND_PID"  ]] && kill "$BACKEND_PID"  2>/dev/null && info "Backend stopped  (PID $BACKEND_PID)"
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null && info "Frontend stopped (PID $FRONTEND_PID)"
  exit 0
}
trap cleanup INT TERM

echo ""
echo "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo "${BOLD}  🏛️  Nirmaan AI — SME IPO DRHP Generator${RESET}"
echo "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── 1. Check .env ─────────────────────────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  warn ".env not found. Creating a template at $ENV_FILE"
  cat > "$ENV_FILE" <<EOF
GROQ_API_KEY=gsk_your_key_here
GEMINI_API_KEY=your_gemini_key_here
JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
EOF
  warn "Fill in your API keys in .env, then re-run ./run.sh"
  warn "A random JWT_SECRET_KEY has been generated for you."
  exit 1
fi

# JWT_SECRET_KEY is required — the backend refuses to start without it, because
# it previously fell back to a secret hardcoded in the source.
if ! grep -q "^JWT_SECRET_KEY=." "$ENV_FILE" 2>/dev/null; then
  warn "JWT_SECRET_KEY missing from .env — generating one now."
  printf 'JWT_SECRET_KEY=%s\n' "$(python3 -c 'import secrets; print(secrets.token_hex(32))' 2>/dev/null || openssl rand -hex 32)" >> "$ENV_FILE"
  warn "Existing login sessions (if any) are now invalid; users must sign in again."
fi

# Warn if placeholder values are still present
if grep -q "your_key_here\|your_gemini_key_here" "$ENV_FILE" 2>/dev/null; then
  warn ".env contains placeholder values — AI features may not work until real keys are added."
fi
success ".env found"

# ── 2. Python virtual environment ────────────────────────────────────────────
# Require Python 3.12 — several deps (docling, tokenizers) don't support 3.14 yet
PYTHON_BIN=""
for candidate in python3.12 python3.11 python3.10; do
  if command -v "$candidate" &>/dev/null; then
    PYTHON_BIN="$candidate"
    break
  fi
done

if [[ -z "$PYTHON_BIN" ]]; then
  error "Python 3.12 (or 3.11/3.10) not found."
  error "Install it with: brew install python@3.12"
  error "Then re-run ./run.sh"
  exit 1
fi

PY_VER=$("$PYTHON_BIN" --version 2>&1)
info "Using $PY_VER  ($PYTHON_BIN)"

if [[ ! -d "$VENV_DIR" ]]; then
  info "Creating Python virtual environment at .venv ..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
  success "Virtual environment created"
else
  # Verify the existing venv is not Python 3.14
  VENV_PY_VER=$("$VENV_DIR/bin/python3" --version 2>&1 | grep -o "3\.[0-9]*")
  if [[ "$VENV_PY_VER" == "3.14" ]]; then
    warn "Existing .venv uses Python 3.14 which is incompatible. Recreating with $PYTHON_BIN ..."
    rm -rf "$VENV_DIR"
    "$PYTHON_BIN" -m venv "$VENV_DIR"
    success "Virtual environment recreated"
  fi
fi

# Activate venv
source "$VENV_DIR/bin/activate"
success "Virtual environment activated  ($(python3 --version))"

# ── 3. Python dependencies ───────────────────────────────────────────────────
REQUIREMENTS="$SCRIPT_DIR/requirements.txt"
if [[ -f "$REQUIREMENTS" ]]; then
  info "Installing / verifying Python dependencies ..."
  pip install -q -r "$REQUIREMENTS"
  success "Python dependencies ready"
else
  warn "requirements.txt not found — skipping pip install"
fi

# ── 4. Seed demo database ─────────────────────────────────────────────────────
if $SEED; then
  info "Seeding demo database ..."
  python3 "$SCRIPT_DIR/scripts/start_demo.py"
  success "Demo database seeded"
else
  # Auto-seed only if no DB file exists yet
  DB_FILE=$(find "$SCRIPT_DIR" -maxdepth 3 -name "*.db" 2>/dev/null | head -1)
  if [[ -z "$DB_FILE" ]]; then
    info "No database found — running initial seed ..."
    python3 "$SCRIPT_DIR/scripts/start_demo.py"
    success "Demo database seeded"
  fi
fi

# ── 5. Frontend dependencies ──────────────────────────────────────────────────
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  info "Installing frontend npm dependencies ..."
  (cd "$FRONTEND_DIR" && npm install --silent)
  success "Frontend dependencies installed"
else
  success "Frontend node_modules present — skipping npm install"
fi

# ── 6. Start backend ──────────────────────────────────────────────────────────
# Ensure ports are free before starting
lsof -ti:"$BACKEND_PORT" | xargs kill -9 2>/dev/null || true
lsof -ti:"$FRONTEND_PORT" | xargs kill -9 2>/dev/null || true

info "Starting backend on http://localhost:${BACKEND_PORT} ..."
(cd "$SCRIPT_DIR" && uvicorn src.api.server:app \
  --host 0.0.0.0 \
  --port "$BACKEND_PORT" \
  2>&1 | sed 's/^/  [backend] /') &
BACKEND_PID=$!
success "Backend started  (PID $BACKEND_PID)"

# Give uvicorn a moment to bind
sleep 2

# ── 7. Start frontend ─────────────────────────────────────────────────────────
info "Starting frontend on http://localhost:${FRONTEND_PORT} ..."
(cd "$FRONTEND_DIR" && npm run dev \
  2>&1 | sed 's/^/  [frontend] /') &
FRONTEND_PID=$!
success "Frontend started (PID $FRONTEND_PID)"

# ── 8. Ready ──────────────────────────────────────────────────────────────────
echo ""
echo "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo "  ${GREEN}Frontend${RESET}   →  http://localhost:${FRONTEND_PORT}"
echo "  ${GREEN}Backend${RESET}    →  http://localhost:${BACKEND_PORT}"
echo "  ${GREEN}API Docs${RESET}   →  http://localhost:${BACKEND_PORT}/docs"
echo ""
echo "  Press ${BOLD}Ctrl+C${RESET} to stop both servers."
echo ""
echo "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# ── 9. Wait ───────────────────────────────────────────────────────────────────
wait