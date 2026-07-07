from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.extraction.schema import Base, GeneratedSection, Company, FinancialStatement, DirectorKMP, OfferDetails
from src.api import wizard

import uuid

# ─────────────────────────────────────────────
# DATABASE SETUP — unified to one SQLite for demo
# ─────────────────────────────────────────────
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_wizard.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

# ─────────────────────────────────────────────
# APP + CORS
# ─────────────────────────────────────────────
app = FastAPI(title="SME IPO Offer Document Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# DB DEPENDENCY
# ─────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─────────────────────────────────────────────
# PRIORITY 1 — GET /api/sections/{company_id}
# Now includes flagged_gaps in the response
# ─────────────────────────────────────────────
@app.get("/api/sections/{company_id}")
def get_company_sections(company_id: str):
    db = SessionLocal()
    try:
        sec_uuid = uuid.UUID(company_id)
        sections = db.query(GeneratedSection).filter(GeneratedSection.company_id == sec_uuid).all()
        return [{
            "id": str(s.id),
            "name": s.section_name,
            "status": s.status,
            "locked": s.is_locked,
            "score": s.completeness_score or 0.0,
            "draft_text": s.draft_text or "",
            "flagged_gaps": s.flagged_gaps or [],              # ← was missing before
            "supporting_clause_ids": s.supporting_clause_ids or []
        } for s in sections]
    finally:
        db.close()

# ─────────────────────────────────────────────
# PRIORITY 1 — POST /api/agent/run
# THE KEY BRIDGE: calls the real LangGraph agent
# ─────────────────────────────────────────────
class AgentRunRequest(BaseModel):
    company_id: str
    section_name: str

@app.post("/api/agent/run")
def run_agent(request: AgentRunRequest):
    """
    Triggers the full LangGraph pipeline for a given section.
    Runs: RAG retrieval → consistency check → Groq drafting → gap validation → HITL interrupt.
    Saves the result to the generated_section table.
    """
    db = SessionLocal()
    try:
        comp_uuid = uuid.UUID(request.company_id)
        company = db.query(Company).filter(Company.id == comp_uuid).first()
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        # Build the initial agent state
        from src.agent.orchestrator import graph, AgentState
        initial_state: AgentState = {
            "company_name": company.name,
            "current_section": request.section_name,
            "regulatory_context": "",
            "precedent_context": "",
            "company_facts": "",
            "consistency_errors": [],
            "draft_text": "",
            "human_feedback": "",
            "status": "draft",
            "completeness_score": 0.0,
            "revisions": 0,
            "gaps": []
        }

        # Generate a unique thread ID per run
        thread_id = str(uuid.uuid4())
        config = {"configurable": {"thread_id": thread_id}}

        # Run the graph — it will pause at HITL interrupt
        # We run in "interrupt before hitl_review" mode so the agent completes
        # drafting + gap validation, then we snapshot the result without blocking.
        try:
            result = graph.invoke(initial_state, config=config)
        except Exception as agent_error:
            # LangGraph raises an interrupt exception — that's normal
            # We need to snapshot the state at the interrupt point
            state_snapshot = graph.get_state(config)
            result = state_snapshot.values

        draft_text = result.get("draft_text", "")
        completeness_score = result.get("completeness_score", 0.0)
        gaps = result.get("gaps", [])

        # Check if a section already exists for this company+section
        existing = db.query(GeneratedSection).filter(
            GeneratedSection.company_id == comp_uuid,
            GeneratedSection.section_name == request.section_name
        ).first()

        if existing:
            # Update existing section
            existing.draft_text = draft_text
            existing.completeness_score = completeness_score
            existing.flagged_gaps = gaps
            existing.status = "draft"
            existing.is_locked = False
            db.commit()
            db.refresh(existing)
            section_id = str(existing.id)
        else:
            # Create new section
            new_section = GeneratedSection(
                company_id=comp_uuid,
                section_name=request.section_name,
                draft_text=draft_text,
                completeness_score=completeness_score,
                flagged_gaps=gaps,
                status="draft",
                is_locked=False
            )
            db.add(new_section)
            db.commit()
            db.refresh(new_section)
            section_id = str(new_section.id)

        return {
            "status": "success",
            "section_id": section_id,
            "section_name": request.section_name,
            "completeness_score": completeness_score,
            "gap_count": len(gaps),
            "draft_preview": draft_text[:300] + "..." if len(draft_text) > 300 else draft_text
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent run failed: {str(e)}")
    finally:
        db.close()

# ─────────────────────────────────────────────
# PRIORITY 1 — GET /api/eligibility/{company_id}
# The live Eligibility Engine result
# ─────────────────────────────────────────────
@app.get("/api/eligibility/{company_id}")
def check_eligibility(company_id: str):
    db = SessionLocal()
    try:
        from src.eligibility.checker import EligibilityEngine
        engine_obj = EligibilityEngine(db_session=db)
        report = engine_obj.check_all(company_id)
        return report.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eligibility check failed: {str(e)}")
    finally:
        db.close()

# ─────────────────────────────────────────────
# PRIORITY 3 — GET /api/readiness/{company_id}
# IPO Readiness Dashboard sub-scores
# ─────────────────────────────────────────────
@app.get("/api/readiness/{company_id}")
def get_readiness(company_id: str):
    db = SessionLocal()
    try:
        comp_uuid = uuid.UUID(company_id)
        sections = db.query(GeneratedSection).filter(
            GeneratedSection.company_id == comp_uuid
        ).all()

        total = 25  # Target: 25 DRHP sections
        done = len([s for s in sections if s.is_locked])
        draft_count = len([s for s in sections if s.status == "draft" and not s.is_locked])
        gap_count = sum(len(s.flagged_gaps or []) for s in sections)

        avg_score = (
            sum(s.completeness_score or 0 for s in sections) / len(sections)
            if sections else 0.0
        )

        # Calculate sub-scores by section category
        financial_sections = ["Financial Statements (3 Years)", "Management Discussion & Analysis", "Capital Structure", "Basis of Issue Price"]
        legal_sections = ["Risk Factors", "Key Industry Regulations", "Corporate Governance", "Other Regulatory & Statutory Disclosures"]
        mgmt_sections = ["Management & Board of Directors", "Key Managerial Personnel (KMP)", "Our Promoters & Promoter Group"]

        def avg_cat_score(names):
            matched = [s for s in sections if s.section_name in names]
            if not matched:
                return 0.0
            return round(sum(s.completeness_score or 0 for s in matched) / len(matched) * 100)

        return {
            "total_sections": total,
            "sections_approved": done,
            "sections_in_draft": draft_count,
            "sections_pending": total - done - draft_count,
            "total_open_gaps": gap_count,
            "overall_score": round(avg_score * 100),
            "financial_score": avg_cat_score(financial_sections),
            "legal_score": avg_cat_score(legal_sections),
            "management_score": avg_cat_score(mgmt_sections),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

# ─────────────────────────────────────────────
# DEMO ENDPOINT
# ─────────────────────────────────────────────
@app.get("/api/demo/company")
def get_demo_company():
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.name == "TechServ Solutions Ltd").first()
        if company:
            return {"company_id": str(company.id), "company_name": company.name}
        company = db.query(Company).first()
        if company:
            return {"company_id": str(company.id), "company_name": company.name}
        return {"company_id": None, "company_name": None}
    finally:
        db.close()

# ─────────────────────────────────────────────
# WIZARD + PHASE 9 ROUTERS
# ─────────────────────────────────────────────
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
