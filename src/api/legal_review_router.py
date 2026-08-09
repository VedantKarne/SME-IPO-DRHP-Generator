"""
legal_review_router.py

FastAPI router for Legal Advisor-specific actions on DRHP sections and
legal documents.

Endpoints:
  GET  /api/legal/flags                              — AI-engine flags for legal sections
  POST /api/legal/sections/{section_id}/approve      — Legal Advisor approves a section
  POST /api/legal/sections/{section_id}/review       — Comment or request changes
  GET  /api/legal/sections/{section_id}/review       — List legal review notes for a section
  POST /api/legal/documents/upload                   — Upload a legal-category document
  GET  /api/legal/documents                          — List legal-category documents

Design notes:
  - Approval here sets status='legal_advisor_approved' — distinct from
    'intermediary_certified' (Merchant Banker) and 'promoter_reviewed'.
    Legal Advisor approval does NOT lock the section (is_locked stays False).
  - Comments and change requests reuse the existing ChatMessage table with
    role='legal_reviewer' to keep all reviewer notes in one place.
  - Flags are read directly from GeneratedSection.flagged_gaps filtered to
    the six legal section names — no separate data store.
  - Document uploads reuse UploadedDocument with legal-specific doc_types.
  - This router DOES NOT modify locking_router.py or any other router.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import uuid
import os
import shutil

from src.extraction.db_session import SessionLocal
from src.extraction.schema import GeneratedSection, AuditLog, ChatMessage, UploadedDocument
from src.api.auth_router import get_current_user, require_company_access

router = APIRouter(prefix="/api/legal", tags=["Legal Advisor"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Section names as stored in GeneratedSection.section_name that are
# considered "legal" sections. Partial match is used (ilike) for resilience
# to minor wording differences in LLM output.
LEGAL_SECTION_KEYWORDS = [
    "risk factor",
    "legal proceeding",
    "outstanding litigation",
    "material contract",
    "government",
    "regulatory matter",
    "other legal",
    "other regulatory",
]

# Legal-specific doc_type values accepted by this router.
LEGAL_DOC_TYPES = {
    "litigation_record",
    "regulatory_approval",
    "material_contract",
    "moa_aoa",
    "licence_copy",
    "legal_other",
}

LEGAL_ADVISOR_APPROVED = "legal_advisor_approved"
LEGAL_REVISION_REQUESTED = "legal_revision_requested"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _is_legal_section(section_name: str) -> bool:
    """Return True if the section name matches any known legal section keyword."""
    name_lower = (section_name or "").lower()
    return any(kw in name_lower for kw in LEGAL_SECTION_KEYWORDS)


# ---------------------------------------------------------------------------
# Flags endpoint — reads real gap_detector output, filtered to legal sections
# ---------------------------------------------------------------------------

@router.get("/flags")
def get_legal_flags(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return gap_detector and consistency_checker flags for legal sections only.
    Reads from GeneratedSection.flagged_gaps — no separate data copy.
    """
    company_id_str = current_user.get("company_id")
    try:
        company_id = uuid.UUID(company_id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid company_id in token")

    sections = (
        db.query(GeneratedSection)
        .filter(GeneratedSection.company_id == company_id)
        .all()
    )

    legal_flags = []
    for s in sections:
        if not _is_legal_section(s.section_name):
            continue
        gaps = s.flagged_gaps or []
        if not gaps:
            continue
        legal_flags.append({
            "section_id": str(s.id),
            "section_name": s.section_name,
            "flag_count": len(gaps),
            "status": "issues" if gaps else "clear",
            "gaps": [
                {
                    "clause_id": g.get("clause_id", ""),
                    "description": g.get("description", str(g)),
                    "is_critical": g.get("is_critical", True),
                }
                if isinstance(g, dict)
                else {"clause_id": "", "description": str(g), "is_critical": True}
                for g in gaps
            ],
            "is_locked": s.is_locked,
            "status_db": s.status,
        })

    return {"flags": legal_flags, "total_flagged_sections": len(legal_flags)}


# ---------------------------------------------------------------------------
# Approve
# ---------------------------------------------------------------------------

class LegalApproveResponse(BaseModel):
    section_id: str
    status: str
    is_locked: bool


@router.post("/sections/{section_id}/approve", response_model=LegalApproveResponse)
def legal_approve_section(
    section_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Legal Advisor approves a legal section.
    Sets status='legal_advisor_approved'. Does NOT set is_locked=True —
    that is reserved for Merchant Banker certification only.
    """
    section = db.query(GeneratedSection).filter(GeneratedSection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    require_company_access(current_user, str(section.company_id))

    if not _is_legal_section(section.section_name):
        raise HTTPException(
            status_code=403,
            detail="Legal Advisor can only approve legal-category sections.",
        )

    if section.is_locked:
        raise HTTPException(
            status_code=403,
            detail="Section is certified and locked by Merchant Banker. Legal Advisor cannot modify it.",
        )

    section.status = LEGAL_ADVISOR_APPROVED

    db.add(AuditLog(
        event_type="legal_section_approved",
        company_id=section.company_id,
        section_name=section.section_name,
        query=f"legal_approved_by={current_user.get('sub') or current_user.get('company_id')}",
        model_used="none",
    ))
    db.commit()

    return LegalApproveResponse(
        section_id=str(section.id),
        status=section.status,
        is_locked=section.is_locked,
    )


# ---------------------------------------------------------------------------
# Comment / Request Changes
# ---------------------------------------------------------------------------

class LegalReviewRequest(BaseModel):
    note: str
    request_changes: bool = False


class LegalReviewResponse(BaseModel):
    section_id: str
    status: str
    note_count: int


@router.post("/sections/{section_id}/review", response_model=LegalReviewResponse)
def legal_add_review_note(
    section_id: uuid.UUID,
    req: LegalReviewRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Record a Legal Advisor comment or change request on a legal section.
    Uses role='legal_reviewer' in ChatMessage to distinguish from
    merchant-banker reviewer notes (role='reviewer').
    """
    note = (req.note or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="A note is required.")

    section = db.query(GeneratedSection).filter(GeneratedSection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    require_company_access(current_user, str(section.company_id))

    if not _is_legal_section(section.section_name):
        raise HTTPException(
            status_code=403,
            detail="Legal Advisor can only comment on legal-category sections.",
        )

    if section.is_locked:
        raise HTTPException(
            status_code=403,
            detail="Section is certified and locked. Cannot add review notes.",
        )

    db.add(ChatMessage(
        section_id=section.id,
        role="legal_reviewer",
        content=note,
    ))

    if req.request_changes:
        section.status = LEGAL_REVISION_REQUESTED

    db.add(AuditLog(
        event_type="legal_change_requested" if req.request_changes else "legal_comment",
        company_id=section.company_id,
        section_name=section.section_name,
        query=note[:500],
        model_used="none",
    ))
    db.commit()

    note_count = db.query(ChatMessage).filter(
        ChatMessage.section_id == section.id,
        ChatMessage.role == "legal_reviewer",
    ).count()

    return LegalReviewResponse(
        section_id=str(section.id),
        status=section.status,
        note_count=note_count,
    )


@router.get("/sections/{section_id}/review")
def legal_list_review_notes(
    section_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Legal Advisor review notes for a section, oldest-first."""
    section = db.query(GeneratedSection).filter(GeneratedSection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    require_company_access(current_user, str(section.company_id))

    notes = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.section_id == section.id,
            ChatMessage.role == "legal_reviewer",
        )
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return {
        "section_id": str(section.id),
        "status": section.status,
        "notes": [
            {
                "id": str(n.id),
                "text": n.content,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes
        ],
    }


# ---------------------------------------------------------------------------
# Document upload and listing
# ---------------------------------------------------------------------------

UPLOAD_DIR = os.path.join("uploads", "legal")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/documents/upload")
async def upload_legal_document(
    file: UploadFile = File(...),
    doc_type: str = Form("legal_other"),
    supported_section: str = Form(""),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Upload a legal-category document (litigation record, licence copy, contract, MOA/AOA).
    Stored as UploadedDocument with a legal-specific doc_type.
    """
    company_id_str = current_user.get("company_id")
    try:
        company_id = uuid.UUID(company_id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid company_id in token")

    if doc_type not in LEGAL_DOC_TYPES:
        doc_type = "legal_other"

    # Save file
    dest_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    try:
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File save failed: {e}")

    doc = UploadedDocument(
        company_id=company_id,
        filename=file.filename,
        doc_type=doc_type,
        status="done",
    )
    db.add(doc)

    db.add(AuditLog(
        event_type="legal_document_uploaded",
        company_id=company_id,
        section_name=supported_section or "legal_documents",
        query=f"filename={file.filename}",
        model_used="none",
    ))
    db.commit()

    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "doc_type": doc.doc_type,
        "status": doc.status,
    }


@router.get("/documents")
def list_legal_documents(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List documents uploaded with a legal-category doc_type."""
    company_id_str = current_user.get("company_id")
    try:
        company_id = uuid.UUID(company_id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid company_id in token")

    docs = (
        db.query(UploadedDocument)
        .filter(
            UploadedDocument.company_id == company_id,
            UploadedDocument.doc_type.in_(LEGAL_DOC_TYPES),
        )
        .order_by(UploadedDocument.uploaded_at.desc())
        .all()
    )

    return {
        "documents": [
            {
                "id": str(d.id),
                "filename": d.filename,
                "doc_type": d.doc_type,
                "status": d.status,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            }
            for d in docs
        ]
    }
