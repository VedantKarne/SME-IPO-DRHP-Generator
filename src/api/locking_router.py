from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid

from src.extraction.schema import GeneratedSection
from src.api.server import get_db

router = APIRouter(prefix="/api/sections", tags=["Locking & Approval"])

class LockResponse(BaseModel):
    section_id: str
    status: str
    is_locked: bool

@router.post("/{section_id}/approve", response_model=LockResponse)
def approve_and_lock_section(section_id: str, db: Session = Depends(get_db)):
    """
    Called by the Merchant Banker or Promoter to finalize a section.
    Sets is_locked = True and status = 'intermediary_certified'.
    """
    try:
        sec_uuid = uuid.UUID(section_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid section_id UUID format")
        
    section = db.query(GeneratedSection).filter(GeneratedSection.id == sec_uuid).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
        
    section.is_locked = True
    section.status = 'intermediary_certified'
    db.commit()
    
    return LockResponse(
        section_id=str(section.id),
        status=section.status,
        is_locked=section.is_locked
    )
