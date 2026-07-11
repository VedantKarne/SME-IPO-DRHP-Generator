# 🗃️ Data Schema

> **SQLAlchemy ORM schema reference** — all 8 tables, their columns, relationships, and the rationale behind key data model decisions.

---

## Overview

All structured company data is stored in an **SQLite database** (`test_wizard.db` or `Databases/app_state.db`) using **SQLAlchemy declarative ORM**. The schema is designed for the specific data requirements of a SEBI DRHP — enabling the eligibility engine's arithmetic checks, the agent's company data fetch, and the section locking workflow.

**File**: `src/extraction/schema.py`

---

## Entity Relationship Diagram

```
Company (1)
  ├── FinancialStatement (many — one per fiscal year)
  ├── DirectorKMP (many — one per director/KMP)
  ├── OfferDetails (1)
  └── GeneratedSection (many — one per DRHP section)
       └── ChatMessage (many — one per AI edit message)
```

---

## Table: `company`

Primary entity representing the SME issuer company.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated UUID |
| `cin` | VARCHAR | UNIQUE, NOT NULL | Corporate Identification Number |
| `name` | VARCHAR | NOT NULL | Company legal name |
| `incorporation_date` | DATE | | Date of incorporation |
| `registered_office` | TEXT | | Full registered office address |
| `nic_code` | VARCHAR | | National Industry Classification code |
| `industry` | VARCHAR | | Industry sector description |
| `dynamic_checklist` | JSON | | Flexible bool flags (e.g., `winding_up_petition`) |
| `created_at` | DATETIME | | UTC timestamp |

### Key Design Note: `dynamic_checklist`
A JSON column stores flexible boolean flags that don't warrant a dedicated column:
```python
company.dynamic_checklist = {
    "winding_up_petition": False,  # Eligibility Check 5
    "sebi_action_pending": False,
    "nse_debarment": False
}
```
This prevents schema migrations for new regulatory requirements.

---

## Table: `financial_statement`

Three financial years (FY2022, FY2023, FY2024) per company.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated UUID |
| `company_id` | UUID | FK → company.id | Parent company |
| `fiscal_year` | INTEGER | NOT NULL | e.g., 2024 |
| `revenue_lakhs` | FLOAT | | Total revenue in ₹ Lakhs |
| `ebitda_lakhs` | FLOAT | | Operating profit in ₹ Lakhs |
| `pat_lakhs` | FLOAT | | Profit After Tax in ₹ Lakhs |
| `net_worth_lakhs` | FLOAT | | Net worth (equity) in ₹ Lakhs |
| `paid_up_capital_lakhs` | FLOAT | | Current paid-up capital in ₹ Lakhs |

### All Financials in Lakhs
Storing in Lakhs (not Rupees) keeps numbers manageable and consistent with SEBI DRHP reporting conventions. The eligibility check threshold of ₹1 Crore = `100.0` Lakhs.

---

## Table: `director_kmp`

Directors and Key Managerial Personnel.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated UUID |
| `company_id` | UUID | FK → company.id | Parent company |
| `name` | VARCHAR | NOT NULL | Full legal name |
| `din` | VARCHAR | | Director Identification Number (SEBI mandatory) |
| `designation` | VARCHAR | | e.g., "Managing Director", "CFO", "Company Secretary" |
| `pending_litigation` | BOOLEAN | DEFAULT False | Whether KMP has pending litigation |
| `qualification` | VARCHAR | | Educational qualification |
| `experience_years` | INTEGER | | Years of relevant experience |

### `pending_litigation` Flag
This single boolean field directly drives **Eligibility Check 4** (`_check_kmp_litigation()`). The field is populated from:
1. The wizard form (`POST /api/wizard/directors/{company_id}`)
2. The onboarding interview's litigation answer (`POST /api/demo/init`)
3. Direct API calls

---

## Table: `offer_details`

IPO offer structure — one record per company.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated UUID |
| `company_id` | UUID | FK → company.id | Parent company |
| `total_shares_offered` | INTEGER | | Number of shares in the IPO |
| `price_per_share` | FLOAT | | Issue price in ₹ |
| `total_issue_size_lakhs` | FLOAT | | Auto-calculated by backend: `(shares × price) / 100,000` |
| `objects_of_offer` | TEXT | | Purpose of IPO proceeds (narrated) |

### Backend-Side Arithmetic
The `total_issue_size_lakhs` is **calculated on the server side** in `POST /api/wizard/offer/{company_id}`:
```python
offer.total_issue_size_lakhs = (total_shares * price) / 100_000
```
This prevents inconsistency from frontend rounding errors.

---

## Table: `generated_section`

One row per DRHP section per company. Tracks the full lifecycle from draft to certification.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated UUID |
| `company_id` | UUID | FK → company.id | Parent company |
| `section_name` | VARCHAR | NOT NULL | e.g., "Risk Factors" |
| `draft_text` | TEXT | | AI-generated section content (Markdown) |
| `status` | VARCHAR | | `'draft'` \| `'promoter_reviewed'` \| `'intermediary_certified'` |
| `is_locked` | BOOLEAN | DEFAULT False | True after merchant banker approval |
| `completeness_score` | FLOAT | | 0.0–1.0 completeness metric |
| `supporting_clause_ids` | JSON | | Array of regulatory clause IDs cited |
| `flagged_gaps` | JSON | | Array of Gap objects `{clause_id, description, is_critical}` |
| `created_at` | DATETIME | | UTC timestamp |
| `updated_at` | DATETIME | | Last updated timestamp |

### Section Lifecycle
```
pending (not in DB) → draft (first generation) → promoter_reviewed (HITL approved)
                                                         ↓
                                             intermediary_certified (merchant banker locked)
```

Once `is_locked=True`:
- The API rejects further chat edits via `POST /api/sections/{id}/chat`.
- The section enters the read-only view in the workspace.
- The section is eligible for inclusion in the final DRHP assembly.

### `flagged_gaps` JSON Structure
```json
[
  {
    "clause_id": "ICDR_GAP_RISK_FACTORS",
    "description": "Specific risk quantification for raw material price volatility",
    "is_critical": true
  },
  {
    "clause_id": "ICDR_GAP_RISK_FACTORS",
    "description": "Insurance coverage details",
    "is_critical": true
  }
]
```

---

## Table: `chat_message`

Persists the conversation history for each section's AI editing session.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | Auto-generated UUID |
| `section_id` | UUID | FK → generated_section.id | Parent section |
| `role` | VARCHAR | | `'user'` \| `'assistant'` |
| `content` | TEXT | | Message text |
| `created_at` | DATETIME | | UTC timestamp |

---

## Database Session Management (`src/extraction/db_session.py`)

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///test_wizard.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite + FastAPI
    echo=False                                   # Set True for SQL debug logging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

The `get_db()` generator is used as a FastAPI dependency injection:
```python
@app.get("/api/eligibility/{company_id}")
def check_eligibility(company_id: str, db: Session = Depends(get_db)):
    ...
```

---

## Additional Stores

Beyond the main SQLite database, the system uses two additional stores:

### Parent Document Store (`src/retrieval/parent_doc_store.py`)
- **Location**: `Databases/parent_doc_store.db`
- **Purpose**: Maps child chunk IDs to their full parent passage text
- **Schema**: Single table `parent_chunks(chunk_id TEXT PK, parent_id TEXT, parent_text TEXT)`
- **Access**: `ParentDocStore.expand_to_parent(chunk_id: str) -> Optional[str]`

### Sparse Vector Index
- **Location**: `Databases/.chroma/fallback_sparse.json`
- **Format**: `{chunk_id: {"token": weight, ...}}`
- **Purpose**: Stores BGE-M3 sparse lexical weights (not supported natively in ChromaDB Python API)
- **Managed by**: `src/retrieval/vector_store.py`
