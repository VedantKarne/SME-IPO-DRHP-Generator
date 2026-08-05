import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.extraction.schema import Base

# Target Databases/app_state.db in the project root
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_DIR = os.path.join(ROOT_DIR, "Databases")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "app_state.db")

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def run_migrations():
    """
    Applies additive schema migrations for columns that were added after the
    initial DB was created. Safe to re-run — each ALTER is inside a try/except
    so duplicate-column errors are silently ignored.

    Pattern: always use 'ALTER TABLE ... ADD COLUMN ...' style migrations.
    Never drop or rename columns here — use a proper migration tool for that.
    """
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    migrations = [
        # generated_section: updated_at added in a later schema revision
        "ALTER TABLE generated_section ADD COLUMN updated_at DATETIME",
        # generated_section: langgraph_thread_id added later
        "ALTER TABLE generated_section ADD COLUMN langgraph_thread_id VARCHAR(36)",
        # financial_statement: source column added later
        "ALTER TABLE financial_statement ADD COLUMN source VARCHAR(20) DEFAULT 'promoter_input'",
        # company: dynamic_checklist added later
        "ALTER TABLE company ADD COLUMN dynamic_checklist JSON",
        # company_user: last_login added later
        "ALTER TABLE company_user ADD COLUMN last_login DATETIME",
        # company_user: is_active added later
        "ALTER TABLE company_user ADD COLUMN is_active BOOLEAN DEFAULT 1",
        # readiness_score: created_at added later
        "ALTER TABLE readiness_score ADD COLUMN created_at DATETIME",
        # readiness_score: sub-scores added later
        "ALTER TABLE readiness_score ADD COLUMN documents_score INTEGER",
        "ALTER TABLE readiness_score ADD COLUMN financials_score INTEGER",
        "ALTER TABLE readiness_score ADD COLUMN compliance_score INTEGER",
        "ALTER TABLE readiness_score ADD COLUMN legal_score INTEGER",
        "ALTER TABLE readiness_score ADD COLUMN risk_score INTEGER",
        "ALTER TABLE readiness_score ADD COLUMN next_action TEXT",
    ]
    for sql in migrations:
        try:
            cursor.execute(sql)
        except sqlite3.OperationalError:
            pass  # Column already exists — that's fine
    conn.commit()
    conn.close()

def init_db():
    """Initializes the database by creating all tables and applying migrations."""
    Base.metadata.create_all(bind=engine)
    run_migrations()

def get_db():
    """Dependency to get the database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
