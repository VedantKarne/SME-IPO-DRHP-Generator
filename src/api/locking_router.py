from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid

from src.extraction.schema import GeneratedSection, AuditLog
from src.api.server import get_db
from src.api.auth_router import get_current_user, require_company_access

router = APIRouter(prefix="/api/sections", tags=["Locking & Approval"])

class LockResponse(BaseModel):
    section_id: str
    status: str
    is_locked: bool

@router.post("/{section_id}/approve", response_model=LockResponse)
def approve_and_lock_section(
    section_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Called by the Merchant Banker or Promoter to finalize a section.
    Sets is_locked = True and status = 'intermediary_certified'.

    This is the regulatory sign-off action. It was previously unauthenticated:
    any anonymous caller could certify any section of any company.
    """
    try:
        sec_uuid = uuid.UUID(section_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid section_id UUID format")

    section = db.query(GeneratedSection).filter(GeneratedSection.id == sec_uuid).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    require_company_access(current_user, section.company_id)

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
