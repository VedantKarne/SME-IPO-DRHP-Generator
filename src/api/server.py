from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.extraction.schema import Base, GeneratedSection
from src.api import wizard

# Setup DB Engine (using SQLite for local testing before PostgreSQL)
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_wizard.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SME IPO Offer Document Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow Vite frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency override for router
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/api/sections/{company_id}")
def get_company_sections(company_id: str):
    import uuid
    db = SessionLocal()
    try:
        sec_uuid = uuid.UUID(company_id)
        sections = db.query(GeneratedSection).filter(GeneratedSection.company_id == sec_uuid).all()
        # Return standard dict for frontend
        return [{
            "id": str(s.id),
            "name": s.section_name,
            "status": s.status,
            "locked": s.is_locked,
            "score": s.completeness_score or 0.85,
            "draft_text": s.draft_text
        } for s in sections]
    finally:
        db.close()


@app.get("/api/demo/company")
def get_demo_company():
    db = SessionLocal()
    from src.extraction.schema import Company
    try:
        company = db.query(Company).filter(Company.name == "TechServ Solutions Ltd").first()
        if company:
            return {"company_id": str(company.id)}
        # Fallback to the first company in DB if TechServ isn't there
        company = db.query(Company).first()
        if company:
            return {"company_id": str(company.id)}
        return {"company_id": None}
    finally:
        db.close()

# Override the get_db dependency in the wizard router
app.dependency_overrides[wizard.get_db] = get_db
app.include_router(wizard.router)

from src.api.chat_edit_router import router as chat_edit_router
from src.api.locking_router import router as locking_router
from src.api.impact_router import router as impact_router
from src.api.copilot_router import router as copilot_router

app.include_router(chat_edit_router)
app.include_router(locking_router)
app.include_router(impact_router)
app.include_router(copilot_router)

@app.get("/")
def read_root():
    return {"message": "SME IPO Wizard API is running"}
