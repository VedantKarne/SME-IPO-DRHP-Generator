from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid

from src.extraction.schema import GeneratedSection, AuditLog
from src.api.server import get_db
from src.api.auth_router import get_current_user, require_company_access

router = APIRouter(prefix="/api/sections", tags=["Locking & Approval"])

class LockResponse(BaseModel):
    section_id: uuid.UUID
    status: str
    is_locked: bool

@router.post("/{section_id}/approve", response_model=LockResponse)
def approve_and_lock_section(
    section_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Called by the Merchant Banker or Promoter to finalize a section.
    Sets is_locked = True and status = 'intermediary_certified'.

    This is the regulatory sign-off action. It was previously unauthenticated:
    any anonymous caller could certify any section of any company.
    """
    section = db.query(GeneratedSection).filter(GeneratedSection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    require_company_access(current_user, str(section.company_id))

    section.is_locked = True
    section.status = 'intermediary_certified'

    # Record who certified what, and when. Approval previously left no trace at
    # all, which is untenable for a filing document.
    db.add(AuditLog(
        event_type="section_approved",
        company_id=section.company_id,
        section_name=section.section_name,
        query=f"approved_by={current_user.get('sub') or current_user.get('company_id')}",
        model_used="none",
    ))
    db.commit()

    return LockResponse(
        section_id=str(section.id),
        status=section.status,
        is_locked=section.is_locked
    )


# ---------------------------------------------------------------------------
# Reviewer comments and change requests
# ---------------------------------------------------------------------------
#
# The Review screen kept comments and the "Returned" state in React useState
# only — no API call. Notes vanished on refresh, and a section the reviewer had
# sent back reappeared in the pending queue, so a merchant banker could believe
# they had returned work that the promoter never saw.
#
# Persisted using tables that already exist: the note as a ChatMessage against
# the section, and the returned state via GeneratedSection.status. No migration.

REVISION_REQUESTED = "revision_requested"


class ReviewNoteRequest(BaseModel):
    note: str
    request_changes: bool = False


class ReviewNoteResponse(BaseModel):
    section_id: uuid.UUID
    status: str
    note_count: int


@router.post("/{section_id}/review", response_model=ReviewNoteResponse)
def add_review_note(
    section_id: uuid.UUID,
    req: ReviewNoteRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Record a reviewer comment, optionally returning the section for changes."""
    from src.extraction.schema import ChatMessage

    note = (req.note or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="A note is required.")

    section = db.query(GeneratedSection).filter(GeneratedSection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    require_company_access(current_user, str(section.company_id))

    if section.is_locked:
        raise HTTPException(
            status_code=403,
            detail="This section is certified and locked; unlock it before requesting changes.",
        )

    db.add(ChatMessage(section_id=section.id, role="reviewer", content=note))

    if req.request_changes:
        section.status = REVISION_REQUESTED

    db.add(AuditLog(
        event_type="section_change_requested" if req.request_changes else "section_comment",
        company_id=section.company_id,
        section_name=section.section_name,
        query=note[:500],
        model_used="none",
    ))
    db.commit()

    note_count = db.query(ChatMessage).filter(
        ChatMessage.section_id == section.id,
        ChatMessage.role == "reviewer",
    ).count()

    return ReviewNoteResponse(
        section_id=str(section.id),
        status=section.status,
        note_count=note_count,
    )


@router.get("/{section_id}/review")
def list_review_notes(
    section_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Reviewer notes for a section, oldest first."""
    from src.extraction.schema import ChatMessage

    section = db.query(GeneratedSection).filter(GeneratedSection.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    require_company_access(current_user, str(section.company_id))

    notes = db.query(ChatMessage).filter(
        ChatMessage.section_id == section.id,
        ChatMessage.role == "reviewer",
    ).order_by(ChatMessage.created_at.asc()).all()

    return {
        "section_id": str(section.id),
        "status": section.status,
        "notes": [
            {"id": str(n.id), "text": n.content,
             "created_at": n.created_at.isoformat() if n.created_at else None}
            for n in notes
        ],
    }
