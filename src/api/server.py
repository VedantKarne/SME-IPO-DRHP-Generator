from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.extraction.schema import Base, GeneratedSection, Company, FinancialStatement, DirectorKMP, OfferDetails
from src.api import wizard

import uuid
import logging

from src.api.auth_router import router as auth_router, get_current_user
from src.api.session_router import router as session_router

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# DATABASE SETUP — unified to use the shared app_state.db
# ─────────────────────────────────────────────
from src.extraction.db_session import SessionLocal, engine, init_db

# Initialize the tables in the shared database
init_db()

# ─────────────────────────────────────────────
# APP + CORS
# ─────────────────────────────────────────────
app = FastAPI(title="SME IPO Offer Document Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(session_router)

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
SECTION_DOC_MAP = {
    "Financial Statements (3 Years)": ["0"],
    "Financial Information": ["0"],
    "Management Discussion & Analysis": ["0"],
    "Capital Structure": ["0", "9"],
    "General Information": ["1", "8"],
    "Cover Page & General Information": ["1", "8"],
    "History and Corporate Structure": ["1", "9"],
    "Objects of the Offer": ["1"],
    "Government and Other Approvals": ["2", "3", "5", "8"],
    "Other Regulatory & Statutory Disclosures": ["2", "3", "5", "8"],
    "Our Business": ["2", "3", "4", "5", "6"],
    "Risk Factors": ["2", "3", "4", "6", "7"],
    "Outstanding Litigations and Material Developments": ["7"]
}

DOC_TYPE_LABELS = {
    "0": "Audited Financial Statements",
    "1": "Board Resolution for IPO",
    "2": "Factory Licence / Registration",
    "3": "Pollution Certificate",
    "4": "Factory Insurance Policy",
    "5": "Trademark Certificates",
    "6": "Vendor & Customer Contracts",
    "7": "Litigation / Legal Notices",
    "8": "GST Registration Certificate",
    "9": "Memorandum & Articles of Association"
}

SECTIONS_25 = [
    "Cover Page & General Information", "Risk Factors", "Introduction", "General Information",
    "Capital Structure", "Objects of the Offer", "Basis of Issue Price", "Statement of Tax Benefits",
    "About the Company", "Industry Overview", "Our Business", "Key Industry Regulations",
    "History and Corporate Structure", "Management & Board of Directors",
    "Key Managerial Personnel (KMP)", "Our Promoters & Promoter Group",
    "Related Party Transactions", "Dividend Policy", "Financial Statements (3 Years)",
    "Management Discussion & Analysis", "Corporate Governance", "Terms of the Issue",
    "Other Regulatory & Statutory Disclosures", "Material Contracts & Documents",
    "Declaration & Undertakings"
]

@app.get("/api/sections/{company_id}")
def get_company_sections(company_id: str, current_user: dict = Depends(get_current_user)):
    db = SessionLocal()
    try:
        sec_uuid = uuid.UUID(company_id)
        sections = db.query(GeneratedSection).filter(GeneratedSection.company_id == sec_uuid).all()
        section_map = {s.section_name: s for s in sections}
        
        from src.extraction.schema import UploadedDocument
        uploaded_docs = db.query(UploadedDocument).filter(
            UploadedDocument.company_id == sec_uuid,
            UploadedDocument.status == 'done'
        ).all()
        
        doc_latest_uploads = {}
        for doc in uploaded_docs:
            if doc.uploaded_at:
                if doc.doc_type not in doc_latest_uploads or doc.uploaded_at > doc_latest_uploads[doc.doc_type]:
                    doc_latest_uploads[doc.doc_type] = doc.uploaded_at
                
        result = []
        for s_name in SECTIONS_25:
            s = section_map.get(s_name)
            has_draft = bool(s and s.draft_text)
            is_locked = bool(s and s.is_locked)
            flagged_gaps = s.flagged_gaps if s else []
            has_gaps = bool(flagged_gaps)

            required_doc_types = SECTION_DOC_MAP.get(s_name, [])
            missing_docs = []
            unsynced_docs = []

            all_required_present = True
            stale = False

            for dtype in required_doc_types:
                if dtype not in doc_latest_uploads:
                    missing_docs.append(DOC_TYPE_LABELS.get(dtype, dtype))
                    all_required_present = False
                else:
                    doc_uploaded_at = doc_latest_uploads[dtype]
                    section_updated_at = s.updated_at or s.created_at if s else None
                    if not section_updated_at or doc_uploaded_at > section_updated_at:
                        unsynced_docs.append(DOC_TYPE_LABELS.get(dtype, dtype))
                        stale = True

            # ── State Machine ──────────────────────────────────────────────────────
            # 🟢 GREEN  : Section is fully complete.
            #             Conditions: draft exists + all required docs synced (not stale)
            #             + NO flagged gaps remaining (or section is locked/approved).
            #             Locked sections are always Green regardless of gaps.
            #
            # 🟠 ORANGE : Section is in-progress — something can be done RIGHT NOW.
            #             Covers:
            #               (a) All required docs are present but section not yet generated.
            #               (b) Draft exists but a new doc was uploaded after it (stale).
            #               (c) Draft exists but flagged gaps remain to be resolved.
            #
            # 🔴 RED    : Section is BLOCKED. Cannot proceed until:
            #               (a) A required document is uploaded (if doc-dependent), OR
            #               (b) Section has no doc deps and hasn't been generated at all.
            # ─────────────────────────────────────────────────────────────────────

            if is_locked:
                # Promoter-approved sections are always GREEN regardless of gaps
                sync_status = "green"

            elif not required_doc_types:
                # Doc-independent sections (rely on promoter onboarding data only).
                if not has_draft:
                    sync_status = "red"       # Nothing generated yet
                elif has_gaps:
                    sync_status = "orange"    # Generated but gaps remain
                else:
                    sync_status = "green"     # Generated and fully complete

            elif not all_required_present:
                # At least one required document is completely missing → BLOCKED
                sync_status = "red"

            elif not has_draft or stale:
                # All docs present but section not yet generated, or doc re-uploaded after draft
                sync_status = "orange"

            elif has_gaps:
                # Draft exists, docs synced, but flagged gaps still outstanding
                sync_status = "orange"

            else:
                # Draft exists, all docs synced, no flagged gaps → FULLY COMPLETE
                sync_status = "green"

            result.append({
                "id": str(s.id) if s else None,
                "name": s_name,
                "status": s.status if s else "pending",
                "locked": is_locked,
                "score": s.completeness_score if s else 0.0,
                "draft_text": s.draft_text if s else "",
                "flagged_gaps": flagged_gaps,
                "supporting_clause_ids": s.supporting_clause_ids if s else [],
                "sync_status": sync_status,
                "missing_docs": missing_docs,
                "unsynced_docs": unsynced_docs
            })
        return result
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
def run_agent(request: AgentRunRequest, current_user: dict = Depends(get_current_user)):
    """
    Triggers the full LangGraph pipeline for a given section.
    Runs: RAG retrieval → consistency check → Groq drafting → gap validation → HITL interrupt.
    Saves the result (including thread_id) to the generated_section table.
    """
    db = SessionLocal()
    try:
        comp_uuid = uuid.UUID(request.company_id)
        company = db.query(Company).filter(Company.id == comp_uuid).first()
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        from src.agent.orchestrator import graph, AgentState
        
        # Bug 1 Fix: Generate thread_id here and persist it to the DB so the
        # HITL resume endpoint can retrieve and use it.
        thread_id = str(uuid.uuid4())
        config = {"configurable": {"thread_id": thread_id}}

        initial_state: AgentState = {
            "company_name": company.name,
            "company_id": str(company.id),       # ← Pass company_id for client_documents retrieval
            "current_section": request.section_name,
            "regulatory_context": "",
            "precedent_context": "",
            "company_facts": "",
            "consistency_errors": [],
            "draft_text": "",
            "human_feedback": "",
            "status": "draft",
            "langgraph_thread_id": thread_id,
            "completeness_score": 0.0,
            "revisions": 0,
            "gaps": []
        }


        try:
            graph.invoke(initial_state, config=config)
        except Exception as agent_exc:
            # Some LangGraph versions raise GraphInterrupt; others return silently.
            # We log it but always fall through to read state from checkpointer below.
            logger.warning(f"graph.invoke raised (may be normal interrupt): {agent_exc}")

        # Always read the accumulated state from the MemorySaver checkpointer.
        # This is the only reliable source of truth for both:
        #   (a) Normal completion  — state has final values
        #   (b) HITL interrupt     — graph.invoke() returns {}, state is in checkpointer
        state_snapshot = graph.get_state(config)
        result = state_snapshot.values if state_snapshot and state_snapshot.values else {}

        draft_text = result.get("draft_text", "")
        completeness_score = result.get("completeness_score", 0.0)
        gaps = result.get("gaps", [])

        # ── Post-process: strip inline ⚠️ GAP markers from the draft text ─────────
        # The gap_detector extracts them into `gaps` (flagged_gaps). We must also
        # clean the draft so readers see only the finished prose, not placeholder tokens.
        import re

        # Remove full lines that are *only* a GAP marker (e.g. a standalone bullet line)
        draft_text = re.sub(r"^[ \t]*(?:⚠️\s*)?GAP:\s*[^\n]+$", "", draft_text, flags=re.MULTILINE | re.IGNORECASE)

        # Remove inline GAP markers embedded mid-sentence
        draft_text = re.sub(r"(?:⚠️\s*)?GAP:\s*\[?[^,.;\n⚠️\]]+\]?", "[information pending]", draft_text, flags=re.IGNORECASE)

        # Clean up leftover ⚠️ emoji if any remain orphaned
        draft_text = re.sub(r"⚠️\s*", "", draft_text)

        # Collapse multiple blank lines caused by removed markers
        draft_text = re.sub(r"\n{3,}", "\n\n", draft_text).strip()
        # ─────────────────────────────────────────────────────────────────────────

        existing = db.query(GeneratedSection).filter(
            GeneratedSection.company_id == comp_uuid,
            GeneratedSection.section_name == request.section_name
        ).first()

        if existing:
            existing.draft_text = draft_text
            existing.completeness_score = completeness_score
            existing.flagged_gaps = gaps
            existing.status = "draft"
            existing.is_locked = False
            existing.langgraph_thread_id = thread_id  # Bug 1 Fix: always refresh thread_id
            db.commit()
            db.refresh(existing)
            section_id = str(existing.id)
        else:
            new_section = GeneratedSection(
                company_id=comp_uuid,
                section_name=request.section_name,
                draft_text=draft_text,
                completeness_score=completeness_score,
                flagged_gaps=gaps,
                status="draft",
                is_locked=False,
                langgraph_thread_id=thread_id  # Bug 1 Fix: persist thread_id
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
            "langgraph_thread_id": thread_id,  # Bug 1 Fix: expose to frontend
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
def check_eligibility(company_id: str, current_user: dict = Depends(get_current_user)):
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
def get_readiness(company_id: str, current_user: dict = Depends(get_current_user)):
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
# AUTH endpoints (ME & SETUP) replacing Demo
# ─────────────────────────────────────────────
@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "company_id": current_user.get("company_id"),
        "company_name": current_user.get("company_name"),
        "role": current_user.get("role")
    }

class SetupRequest(BaseModel):
    name: str
    industry: str
    years: str
    revenue: str
    litigations: str

@app.post("/api/companies/{company_id}/setup")
def setup_company(company_id: str, request: SetupRequest, current_user: dict = Depends(get_current_user)):
    """
    Takes the answers from the Nirmaan Landing interview and dynamically
    updates the company so the workspace reflects the user's actual inputs.
    """
    db = SessionLocal()
    try:
        comp_uuid = uuid.UUID(company_id)
        company = db.query(Company).filter(Company.id == comp_uuid).first()
        if not company:
            return {"status": "error", "detail": "Company not found"}

        company.name = request.name
        
        # Parse litigation answer roughly
        ans = request.litigations.lower()
        has_lit = any(word in ans for word in ["yes", "yeah", "have", "pending", "yup", "true", "one", "two"])
        if "no" in ans or "not" in ans:
            has_lit = False

        # Update KMP litigation flag so the Eligibility Engine reacts dynamically
        director = db.query(DirectorKMP).filter(DirectorKMP.company_id == company.id).first()
        if director:
            director.pending_litigation = has_lit
            director.litigation_details = "Pending civil case" if has_lit else ""
            
        db.commit()
        return {"status": "success"}
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

from src.api.document_upload_router import router as document_upload_router
app.include_router(document_upload_router)

from src.api.admin_router import router as admin_router
app.include_router(admin_router)


# ─────────────────────────────────────────────
# Bug 1 Fix: HITL Resume Endpoints mounted on the MAIN app.
# Previously these lived in a dead-letter hitl_server.py that ran
# as a separate process and had no access to the same MemorySaver graph.
# ─────────────────────────────────────────────
from langgraph.types import Command as LangGraphCommand
from pydantic import BaseModel as PydanticBaseModel
from typing import Optional as OptionalType

class HitlFeedbackRequest(PydanticBaseModel):
    action: str  # "approve", "revise", "reject"
    feedback: OptionalType[str] = None

@app.get("/api/hitl/pending/{section_id}")
def get_hitl_pending(section_id: str):
    """
    Returns the HITL interrupt payload for a section that is paused awaiting human review.
    Uses the langgraph_thread_id stored in the DB to retrieve the correct graph state.
    """
    db = SessionLocal()
    try:
        from src.agent.orchestrator import graph
        sec_uuid = uuid.UUID(section_id)
        section = db.query(GeneratedSection).filter(GeneratedSection.id == sec_uuid).first()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        if not section.langgraph_thread_id:
            raise HTTPException(status_code=404, detail="No active HITL thread for this section. Run the agent first.")

        config = {"configurable": {"thread_id": section.langgraph_thread_id}}
        state = graph.get_state(config)

        if not state.next:
            return {"status": "completed_or_not_paused"}

        pending_tasks = state.tasks
        if not pending_tasks or not pending_tasks[0].interrupts:
            return {"status": "no_interrupts_found"}

        payload = pending_tasks[0].interrupts[0].value
        return {"status": "pending_review", "payload": payload}
    finally:
        db.close()

@app.post("/api/hitl/submit/{section_id}")
def submit_hitl_feedback(section_id: str, req: HitlFeedbackRequest):
    """
    Resumes a paused LangGraph HITL interrupt with the human's decision.
    The thread_id is looked up from the DB, so no in-memory state is required.
    """
    db = SessionLocal()
    try:
        from src.agent.orchestrator import graph
        sec_uuid = uuid.UUID(section_id)
        section = db.query(GeneratedSection).filter(GeneratedSection.id == sec_uuid).first()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        if not section.langgraph_thread_id:
            raise HTTPException(status_code=404, detail="No active HITL thread for this section.")

        config = {"configurable": {"thread_id": section.langgraph_thread_id}}
        resume_payload = {"action": req.action, "feedback": req.feedback}

        # Stream the resumed graph until it completes or pauses again
        for event in graph.stream(LangGraphCommand(resume=resume_payload), config=config):
            pass

        new_state = graph.get_state(config)
        final_status = new_state.values.get("status", "unknown")

        # Sync DB status with graph outcome
        if req.action == "approve":
            section.status = "promoter_reviewed"
        elif req.action == "reject":
            section.status = "rejected"
        db.commit()

        if not new_state.next:
            return {"status": "completed", "section_status": final_status}
        else:
            return {"status": "paused_again", "next_nodes": new_state.next}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"HITL resume failed: {str(e)}")
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "SME IPO Wizard API is running"}

