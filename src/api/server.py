from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.extraction.schema import Base, GeneratedSection, Company, FinancialStatement, DirectorKMP, OfferDetails, AuditLog, SectionVersion
from src.api import wizard

import os
import uuid
import logging

from src.api.auth_router import router as auth_router, get_current_user, require_company_access
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
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
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
# Which uploaded document types a section depends on, keyed by doc_type id.
#
# Three keys used to be unreachable because they are not members of
# SECTIONS_25, and the lookup iterates SECTIONS_25 — so their rules never fired.
# "Financial Information" and "Government and Other Approvals" duplicated rules
# already covered by "Financial Statements (3 Years)" and "Other Regulatory &
# Statutory Disclosures" respectively, and are dropped.
#
# "Outstanding Litigations and Material Developments" is now in the section
# list as "Outstanding Litigation and Material Developments" (matching real
# precedent filings, which use the singular form). doc_type 7 (Litigation /
# Legal Notices) maps directly to it. The Risk Factors stopgap is removed.
SECTION_DOC_MAP = {
    "Financial Statements (3 Years)": ["0"],
    "Management Discussion & Analysis": ["0"],
    "Capital Structure": ["0", "9"],
    "General Information": ["1", "8"],
    "Cover Page & General Information": ["1", "8"],
    "History and Corporate Structure": ["1", "9"],
    "Objects of the Offer": ["1"],
    "Other Regulatory & Statutory Disclosures": ["2", "3", "5", "8"],
    "Our Business": ["2", "3", "4", "5", "6"],
    # doc_type 7 (Litigation / Legal Notices) now maps to the dedicated chapter
    # that was added to SECTIONS_25. The previous stopgap of routing to Risk
    # Factors is removed.
    "Outstanding Litigation and Material Developments": ["7"],
    "Risk Factors": ["2", "3", "4", "6"],
}


def required_doc_types(section_name: str) -> list:
    """
    Document types a section depends on, tolerant of section-name variants.

    Falls back to canonical resolution so a rule written against one spelling
    ("Outstanding Litigations..." vs "Outstanding Litigation...") still applies.
    """
    if section_name in SECTION_DOC_MAP:
        return SECTION_DOC_MAP[section_name]

    from src.config.sections import resolve
    target = resolve(section_name)
    if target is None:
        return []
    for key, doc_types in SECTION_DOC_MAP.items():
        if resolve(key) is target:
            return doc_types
    return []

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
    "Other Regulatory & Statutory Disclosures",
    # Added: present in 14/20 real SEBI filings; was previously missing from
    # the section list and routed to Risk Factors as a stopgap via doc_type 7.
    "Outstanding Litigation and Material Developments",
    "Material Contracts & Documents",
    "Declaration & Undertakings"
]

@app.get("/api/sections/{company_id}")
def get_company_sections(company_id: uuid.UUID, current_user: dict = Depends(get_current_user)):
    db = SessionLocal()
    try:
        sections = db.query(GeneratedSection).filter(GeneratedSection.company_id == company_id).all()
        section_map = {s.section_name: s for s in sections}
        
        from src.extraction.schema import UploadedDocument
        uploaded_docs = db.query(UploadedDocument).filter(
            UploadedDocument.company_id == company_id,
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

            required_doc_types_for_section = required_doc_types(s_name)
            missing_docs = []
            unsynced_docs = []

            all_required_present = True
            stale = False

            for dtype in required_doc_types_for_section:
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

            elif not required_doc_types_for_section:
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
    company_id: uuid.UUID
    section_name: str

@app.post("/api/agent/run")
def run_agent(request: AgentRunRequest, current_user: dict = Depends(get_current_user)):
    """
    Triggers the full LangGraph pipeline for a given section.
    Runs: RAG retrieval → consistency check → Groq drafting → gap validation → HITL interrupt.
    Saves the result (including thread_id) to the generated_section table.
    """
    # 1. Look up company synchronously so we can 404 fast
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.id == request.company_id).first()
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
    finally:
        db.close()

    from fastapi.responses import StreamingResponse
    import queue
    import threading
    import json
    import time as _time
    from src.agent.orchestrator import graph, AgentState

    # Bug 1 Fix: Generate thread_id here and persist it to the DB so the
    # HITL resume endpoint can retrieve and use it.
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    stream_q = queue.Queue()

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
        "stream_queue": stream_q,
        "completeness_score": 0.0,
        "revisions": 0,
        "gaps": []
    }

    _run_started = _time.time()

    def run_graph_thread():
        try:
            graph.invoke(initial_state, config=config)
            stream_q.put({"type": "graph_finished"})
        except Exception as agent_exc:
            if type(agent_exc).__name__ in ("GraphInterrupt", "NodeInterrupt"):
                logger.info(f"graph.invoke interrupted (HITL): {agent_exc}")
                stream_q.put({"type": "graph_finished"})
            else:
                logger.error(f"graph.invoke failed: {agent_exc}", exc_info=True)
                stream_q.put({"type": "error", "content": str(agent_exc)})

    threading.Thread(target=run_graph_thread).start()

    async def event_stream():
        import asyncio
        db_session = SessionLocal()
        try:
            while True:
                msg = await asyncio.to_thread(stream_q.get)
                if msg["type"] == "token":
                    yield f"data: {json.dumps({'type': 'token', 'content': msg['content']})}\n\n"
                elif msg["type"] == "error":
                    yield f"data: {json.dumps({'type': 'error', 'content': msg['content']})}\n\n"
                    break
                elif msg["type"] == "graph_finished":
                    # Graph is finished, save state and emit final
                    state_snapshot = graph.get_state(config)
                    result = state_snapshot.values if state_snapshot and state_snapshot.values else {}
                    
                    draft_text = result.get("draft_text", "")
                    completeness_score = result.get("completeness_score", 0.0)
                    gaps = result.get("gaps", [])

                    import re
                    # Clean up draft text
                    draft_text = re.sub(r"^[ \t]*(?:⚠️\s*)?GAP:\s*[^\n]+$", "", draft_text, flags=re.MULTILINE | re.IGNORECASE)
                    draft_text = re.sub(r"(?:⚠️\s*)?GAP:\s*\[?[^,.;\n⚠️\]]+\]?", "[information pending]", draft_text, flags=re.IGNORECASE)
                    draft_text = re.sub(r"⚠️\s*", "", draft_text)
                    draft_text = re.sub(r"\n{3,}", "\n\n", draft_text).strip()

                    existing = db_session.query(GeneratedSection).filter(
                        GeneratedSection.company_id == request.company_id,
                        GeneratedSection.section_name == request.section_name
                    ).first()

                    if existing:
                        existing.draft_text = draft_text
                        existing.completeness_score = completeness_score
                        existing.flagged_gaps = gaps
                        existing.status = "draft"
                        existing.is_locked = False
                        existing.langgraph_thread_id = thread_id
                        db_session.commit()
                        db_session.refresh(existing)
                        section_id = str(existing.id)
                    else:
                        new_section = GeneratedSection(
                            company_id=request.company_id,
                            section_name=request.section_name,
                            draft_text=draft_text,
                            completeness_score=completeness_score,
                            flagged_gaps=gaps,
                            status="draft",
                            is_locked=False,
                            langgraph_thread_id=thread_id
                        )
                        db_session.add(new_section)
                        db_session.commit()
                        db_session.refresh(new_section)
                        section_id = str(new_section.id)

                    try:
                        reg_ctx = result.get("regulatory_context", "") or ""
                        prec_ctx = result.get("precedent_context", "") or ""
                        cited = re.findall(r"\[([^\]\n]{5,200})\]", reg_ctx + "\n" + prec_ctx)
                        db_session.add(AuditLog(
                            event_type="section_generated",
                            company_id=request.company_id,
                            section_name=request.section_name,
                            query=f"generate:{request.section_name}",
                            retrieved_clause_ids=cited[:25],
                            confidence=float(completeness_score or 0.0),
                            model_used="llama-3.1-8b-instant",
                            latency_ms=int((_time.time() - _run_started) * 1000),
                        ))
                        db_session.commit()
                    except Exception as audit_exc:
                        logger.warning(f"Audit log write failed for {request.section_name}: {audit_exc}")

                    final_payload = {
                        "status": "success",
                        "section_id": section_id,
                        "section_name": request.section_name,
                        "completeness_score": completeness_score,
                        "gap_count": len(gaps),
                        "langgraph_thread_id": thread_id,
                        "draft_text": draft_text,
                        "draft_preview": draft_text[:300] + "..." if len(draft_text) > 300 else draft_text
                    }
                    yield f"data: {json.dumps({'type': 'final', 'metadata': final_payload})}\n\n"
                    break
        finally:
            db_session.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ─────────────────────────────────────────────
# PRIORITY 1 — GET /api/eligibility/{company_id}
# The live Eligibility Engine result
# ─────────────────────────────────────────────
@app.get("/api/eligibility/{company_id}")
def check_eligibility(company_id: uuid.UUID, current_user: dict = Depends(get_current_user)):
    db = SessionLocal()
    try:
        from src.eligibility.checker import EligibilityEngine
        engine_obj = EligibilityEngine(db_session=db)
        report = engine_obj.check_all(str(company_id))
        return report.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Eligibility check failed: {str(e)}")
    finally:
        db.close()

# ─────────────────────────────────────────────
# CONSISTENCY CHECKS — GET /api/consistency/{company_id}
# Runs all data-consistency validation rules and returns results.
# Independent of LangGraph — called by the Dashboard at page load.
# ─────────────────────────────────────────────
@app.get("/api/consistency/{company_id}")
def run_consistency_checks(company_id: uuid.UUID, current_user: dict = Depends(get_current_user)):
    """
    Run all consistency validation rules for the given company.

    Returns a structured report with:
      - has_issues: bool
      - issue_count: int
      - checks: list of {field, fix, severity} dicts

    An empty checks list means the data is fully consistent.
    """
    db = SessionLocal()
    try:
        from src.agent.consistency_checker import run_all_checks_by_id
        errors = run_all_checks_by_id(company_id=str(company_id), db=db)
        return {
            "has_issues": len(errors) > 0,
            "issue_count": len(errors),
            "checks": errors,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Consistency check failed: {str(e)}")
    finally:
        db.close()

# ─────────────────────────────────────────────
# ACTIVITY & AUDIT LOG — GET /api/audit/{company_id}
# AuditLog rows are already written on section generation, approval, review/
# comment, document upload and full-DRHP export (see locking_router.py,
# document_upload_router.py, export_router.py and /api/agent/run below) —
# nothing previously read them back. Read-only; no schema change.
# ─────────────────────────────────────────────
@app.get("/api/audit/{company_id}")
def get_audit_log(company_id: str, current_user: dict = Depends(get_current_user)):
    require_company_access(current_user, company_id)
    db = SessionLocal()
    try:
        # Explicit UUID conversion before filtering — passing the raw string
        # straight into .filter(AuditLog.company_id == company_id) is what
        # causes the "'str' object has no attribute 'hex'" error seen
        # elsewhere in this app (e.g. section_version autosave/history).
        comp_uuid = uuid.UUID(str(company_id))
        rows = (
            db.query(AuditLog)
            .filter(AuditLog.company_id == comp_uuid)
            .order_by(AuditLog.timestamp.desc())
            .limit(200)
            .all()
        )
        return [
            {
                "id": str(r.id),
                "event_type": r.event_type,
                "section_name": r.section_name,
                "query": r.query,
                "source_file": r.source_file,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            }
            for r in rows
        ]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid company_id format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit log fetch failed: {str(e)}")
    finally:
        db.close()


# ─────────────────────────────────────────────
# PRIORITY 3 — GET /api/readiness/{company_id}
# IPO Readiness Dashboard sub-scores
# ─────────────────────────────────────────────
def compute_readiness(company_id, db) -> dict:
    """
    Single source of truth for readiness, computed live from generated_section.

    The `readiness_score` table is defined and migrated but nothing in the
    codebase ever writes to it, so /api/session/restore — which read from that
    table — always reported zeros while /api/readiness reported real numbers for
    the same company. Both now call this.
    """
    comp_uuid = company_id
    sections = db.query(GeneratedSection).filter(
        GeneratedSection.company_id == comp_uuid
    ).all()

    total = len(SECTIONS_25)
    done = len([s for s in sections if s.is_locked])
    draft_count = len([s for s in sections if s.status == "draft" and not s.is_locked])
    gap_count = sum(len(s.flagged_gaps or []) for s in sections)

    avg_score = (
        sum(s.completeness_score or 0 for s in sections) / len(sections)
        if sections else 0.0
    )

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


@app.get("/api/health")
def health():
    """
    Real service health. The sidebar used to display a permanently green
    "System Online / Groq + BGE-M3" badge that was never derived from anything,
    so an empty index or a missing API key still read as healthy.
    """
    status = {"api": True, "llm_configured": bool(os.environ.get("GROQ_API_KEY"))}

    try:
        from src.retrieval.vector_store import VectorStore
        vs = VectorStore()
        counts = {name: vs.count(name) for name in
                  ("regulatory_clauses", "precedent_chunks", "client_documents")}
        status["corpus"] = counts
        status["retrieval_ready"] = counts["regulatory_clauses"] > 0
    except Exception as e:
        status["corpus"] = {}
        status["retrieval_ready"] = False
        status["corpus_error"] = str(e)

    status["healthy"] = status["api"] and status["llm_configured"] and status["retrieval_ready"]
    return status


@app.get("/api/readiness/{company_id}")
def get_readiness(company_id: uuid.UUID, current_user: dict = Depends(get_current_user)):
    db = SessionLocal()
    try:
        require_company_access(current_user, str(company_id))
        return compute_readiness(company_id, db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


class VersionCreateRequest(BaseModel):
    label: str
    source: str
    content: dict
    author_label: str


@app.get("/api/sections/{company_id}/{section_name}/versions")
def get_versions(
    company_id: uuid.UUID,
    section_name: str,
    current_user: dict = Depends(get_current_user),
):
    require_company_access(current_user, str(company_id))
    db = next(get_db())
    try:
        versions = db.query(SectionVersion).filter(
            SectionVersion.company_id == company_id,
            SectionVersion.section_name == section_name
        ).order_by(SectionVersion.created_at.desc()).limit(50).all()
        
        return [
            {
                "id": str(v.id),
                "sectionName": v.section_name,
                "label": v.label,
                "source": v.source,
                "content": v.content,
                "authorLabel": v.author_label,
                "timestamp": v.created_at.isoformat()
            }
            for v in versions
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

@app.post("/api/sections/{company_id}/{section_name}/versions")
def save_version(
    company_id: uuid.UUID,
    section_name: str,
    req: VersionCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    require_company_access(current_user, str(company_id))
    db = next(get_db())
    try:
        if req.label == 'Auto-save':
            existing = db.query(SectionVersion).filter(
                SectionVersion.company_id == company_id,
                SectionVersion.section_name == section_name,
                SectionVersion.label == 'Auto-save'
            ).first()
            if existing:
                existing.content = req.content
                # Update time if needed, though created_at is often sufficient for ordering
                db.commit()
                return {"status": "success", "id": existing.id}

        new_version = SectionVersion(
            company_id=company_id,
            section_name=section_name,
            label=req.label,
            source=req.source,
            content=req.content,
            author_label=req.author_label
        )
        db.add(new_version)
        
        # Enforce max versions per section
        versions = db.query(SectionVersion).filter(
            SectionVersion.company_id == company_id,
            SectionVersion.section_name == section_name
        ).order_by(SectionVersion.created_at.desc()).all()
        
        if len(versions) > 50:
            for v in versions[50:]:
                db.delete(v)
                
        db.commit()
        return {"status": "success", "id": str(new_version.id)}
    except Exception as e:
        db.rollback()
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
    revenue: str = ""
    litigations: str = ""

@app.post("/api/companies/{company_id}/setup")
def setup_company(company_id: uuid.UUID, request: SetupRequest, current_user: dict = Depends(get_current_user)):
    """
    Takes the answers from the Nirmaan Landing interview and dynamically
    updates the company so the workspace reflects the user's actual inputs.
    """
    db = SessionLocal()
    try:
        require_company_access(current_user, str(company_id))
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        company.name = request.name

        # Retain the free-text answers instead of discarding them. `industry`
        # and `years` were accepted and silently dropped — the user typed them
        # and nothing kept them. dynamic_checklist is the company-scoped JSON
        # column; a dedicated column would be better if these become load-bearing.
        checklist = dict(company.dynamic_checklist or {})
        checklist["onboarding_answers"] = {
            "industry": request.industry,
            "years_operating": request.years,
            "revenue_freetext": request.revenue,
            "litigation_freetext": request.litigations,
        }
        company.dynamic_checklist = checklist

        # Litigation is now captured per-director through the structured
        # onboarding step (POST /api/wizard/directors). This keyword sniff runs
        # only as a fallback for the older free-text flow, and only when no
        # director record exists — it must not overwrite what a user explicitly
        # entered against a named director.
        directors = db.query(DirectorKMP).filter(DirectorKMP.company_id == company.id).all()
        if request.litigations and not directors:
            ans = request.litigations.lower()
            has_lit = any(w in ans for w in ["yes", "yeah", "have", "pending", "yup", "true"])
            if "no" in ans or "not" in ans:
                has_lit = False
            if has_lit:
                db.add(DirectorKMP(
                    company_id=company.id,
                    name="(unnamed — from onboarding)",
                    pending_litigation=True,
                    litigation_details=request.litigations[:500],
                ))

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
from src.api.canvas_router import router as canvas_router
from src.api.export_router import router as export_router

app.include_router(chat_edit_router)
app.include_router(locking_router)
app.include_router(impact_router)
app.include_router(copilot_router)
app.include_router(canvas_router)
app.include_router(export_router)

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
def get_hitl_pending(
    section_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
):
    """
    Returns the HITL interrupt payload for a section that is paused awaiting human review.
    Uses the langgraph_thread_id stored in the DB to retrieve the correct graph state.
    """
    db = SessionLocal()
    try:
        from src.agent.orchestrator import graph
        section = db.query(GeneratedSection).filter(GeneratedSection.id == section_id).first()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        require_company_access(current_user, section.company_id)
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
def submit_hitl_feedback(
    section_id: uuid.UUID,
    req: HitlFeedbackRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Resumes a paused LangGraph HITL interrupt with the human's decision.
    The thread_id is looked up from the DB, so no in-memory state is required.
    """
    db = SessionLocal()
    try:
        from src.agent.orchestrator import graph
        section = db.query(GeneratedSection).filter(GeneratedSection.id == section_id).first()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")
        require_company_access(current_user, section.company_id)
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

