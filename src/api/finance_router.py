"""
src/api/finance_router.py

FastAPI endpoints backing the Finance/CA role's review workflow. Every
write endpoint here is gated through src/api/finance_permissions.py (the
single centralized permission module) rather than checking role/section
rules inline — see that module for what's allowed and why.

Reads extraction output already stored by the existing pipeline
(document_upload_router.py -> FinancialStatement / FinancialTable);
nothing here re-extracts or calls src/extraction/kpi_extractor.py.

Endpoints:
  GET   /api/finance/{company_id}/financials
  PATCH /api/finance/{company_id}/financials/{fiscal_year}
  POST  /api/finance/{company_id}/financials/{fiscal_year}/verify
  GET   /api/finance/{company_id}/financials/{fiscal_year}/status
  POST  /api/finance/sections/{section_id}/comment
  GET   /api/finance/sections/{section_id}/comments
  GET   /api/finance/{company_id}/clarifications
  POST  /api/finance/sections/{section_id}/finance-review
"""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.extraction.schema import FinancialStatement, FinancialTable, GeneratedSection, ChatMessage, AuditLog
from src.api.server import get_db
from src.api.auth_router import get_current_user, require_company_access
from src.api.finance_permissions import require_finance_ca, require_financial_section, require_not_locked

router = APIRouter(prefix="/api/finance", tags=["Finance/CA Review"])


# ─── Financial data: read / correct / verify ───────────────────────────────

def _serialize_statement(s: FinancialStatement) -> dict:
    return {
        "id": str(s.id),
        "fiscal_year": s.fiscal_year,
        "revenue_lakhs": float(s.revenue_lakhs) if s.revenue_lakhs is not None else None,
        "ebitda_lakhs": float(s.ebitda_lakhs) if s.ebitda_lakhs is not None else None,
        "pat_lakhs": float(s.pat_lakhs) if s.pat_lakhs is not None else None,
        "net_worth_lakhs": float(s.net_worth_lakhs) if s.net_worth_lakhs is not None else None,
        "paid_up_capital_lakhs": float(s.paid_up_capital_lakhs) if s.paid_up_capital_lakhs is not None else None,
        "source": s.source,
    }


@router.get("/{company_id}/financials")
def list_financials(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Read-only: financial statements + parsed financial tables already
    produced by the extraction pipeline and stored in the DB."""
    require_company_access(current_user, company_id)
    comp_uuid = uuid.UUID(company_id)

    statements = (
        db.query(FinancialStatement)
        .filter(FinancialStatement.company_id == comp_uuid)
        .order_by(FinancialStatement.fiscal_year.asc())
        .all()
    )
    tables = (
        db.query(FinancialTable)
        .filter(FinancialTable.company_id == comp_uuid)
        .order_by(FinancialTable.created_at.desc())
        .all()
    )
    return {
        "statements": [_serialize_statement(s) for s in statements],
        "tables": [
            {
                "id": str(t.id),
                "source_file": t.source_file,
                "statement_type": t.statement_type,
                "years": t.years,
                "page": t.page,
            }
            for t in tables
        ],
    }


CORRECTABLE_FIELDS = ["revenue_lakhs", "ebitda_lakhs", "pat_lakhs", "net_worth_lakhs", "paid_up_capital_lakhs"]


class FinancialCorrectionRequest(BaseModel):
    revenue_lakhs: Optional[float] = None
    ebitda_lakhs: Optional[float] = None
    pat_lakhs: Optional[float] = None
    net_worth_lakhs: Optional[float] = None
    paid_up_capital_lakhs: Optional[float] = None


@router.patch("/{company_id}/financials/{fiscal_year}")
def correct_financial_statement(
    company_id: str,
    fiscal_year: int,
    req: FinancialCorrectionRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Finance/CA-only correction of one or more extracted KPI values.

    FinancialStatement has one column per metric — no separate
    original/corrected pair (see HARDCODED_DATA_LOG.md) — so the original
    value is preserved by writing it into an AuditLog entry *before* it's
    overwritten, rather than silently discarding it. `source` is set to
    'finance_corrected' so the row is clearly marked as a manual
    correction, distinct from 'ai_extracted' / 'promoter_input'.
    """
    require_company_access(current_user, company_id)
    require_finance_ca(current_user)
    comp_uuid = uuid.UUID(company_id)

    statement = db.query(FinancialStatement).filter(
        FinancialStatement.company_id == comp_uuid,
        FinancialStatement.fiscal_year == fiscal_year,
    ).first()
    if not statement:
        raise HTTPException(status_code=404, detail=f"No financial statement on file for FY{fiscal_year}.")

    changes = req.model_dump(exclude_unset=True)
    change_log = []
    for field, new_value in changes.items():
        if field not in CORRECTABLE_FIELDS:
            continue
        old_value = getattr(statement, field)
        old_as_float = float(old_value) if old_value is not None else None
        if old_as_float == new_value:
            continue
        change_log.append(f"{field}: {old_as_float} -> {new_value}")
        setattr(statement, field, new_value)

    if not change_log:
        return _serialize_statement(statement)

    statement.source = "finance_corrected"

    db.add(AuditLog(
        event_type="financial_correction",
        company_id=comp_uuid,
        query=f"FY{fiscal_year}: " + "; ".join(change_log),
        model_used="none",
    ))
    db.commit()
    db.refresh(statement)
    return _serialize_statement(statement)


@router.post("/{company_id}/financials/{fiscal_year}/verify")
def verify_financial_statement(
    company_id: str,
    fiscal_year: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Finance/CA validates/confirms a fiscal year's figures as correct and
    marks them verified — one action covering both, since the schema has no
    basis for treating "confirmed correct" and "verified" as distinct
    states (see HARDCODED_DATA_LOG.md).

    No dedicated 'verified' column exists on FinancialStatement; the state
    is event-sourced through AuditLog instead — the latest relevant event
    for a (company, fiscal_year) determines the current verified state,
    read back by GET .../status below. A later correction implicitly
    un-verifies the year (see that endpoint).
    """
    require_company_access(current_user, company_id)
    require_finance_ca(current_user)
    comp_uuid = uuid.UUID(company_id)

    statement = db.query(FinancialStatement).filter(
        FinancialStatement.company_id == comp_uuid,
        FinancialStatement.fiscal_year == fiscal_year,
    ).first()
    if not statement:
        raise HTTPException(status_code=404, detail=f"No financial statement on file for FY{fiscal_year}.")

    db.add(AuditLog(
        event_type="financial_verified",
        company_id=comp_uuid,
        query=f"FY{fiscal_year} marked verified",
        model_used="none",
    ))
    db.commit()
    return {"fiscal_year": fiscal_year, "verified": True}


@router.get("/{company_id}/financials/{fiscal_year}/status")
def financial_statement_status(
    company_id: str,
    fiscal_year: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Current verified state (derived from the latest AuditLog event) plus
    correction history for a fiscal year."""
    require_company_access(current_user, company_id)
    comp_uuid = uuid.UUID(company_id)

    events = (
        db.query(AuditLog)
        .filter(
            AuditLog.company_id == comp_uuid,
            AuditLog.event_type.in_(["financial_verified", "financial_correction"]),
        )
        .order_by(AuditLog.timestamp.asc())
        .all()
    )

    prefix_colon = f"FY{fiscal_year}:"
    prefix_space = f"FY{fiscal_year} "
    relevant = [
        e for e in events
        if (e.query or "").startswith(prefix_colon) or (e.query or "").startswith(prefix_space)
    ]

    verified = False
    corrections = []
    for e in relevant:
        if e.event_type == "financial_verified":
            verified = True
        else:
            verified = False
            corrections.append({"note": e.query, "at": e.timestamp.isoformat() if e.timestamp else None})

    return {"fiscal_year": fiscal_year, "verified": verified, "corrections": corrections}


# ─── Section comments, clarification requests, financial approval ─────────

class SectionCommentRequest(BaseModel):
    note: str
    request_clarification: bool = False


@router.post("/sections/{section_id}/comment")
def add_finance_comment(
    section_id: str,
    req: SectionCommentRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Finance/CA comment, or (if request_clarification) a flagged clarification
    request, on a financial section.

    Mirrors locking_router.py's add_review_note() shape and the is_locked
    guard it already established, but is Finance/CA-only and scoped to
    financial sections. Stored as a ChatMessage exactly like the existing
    Merchant Banker review notes, just with a distinct `role` value so a
    flagged request can be found by GET .../clarifications below without
    mixing into the Merchant Banker's own notes (role='reviewer', untouched).
    """
    require_finance_ca(current_user)

    note = (req.note or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="A note is required.")

    try:
        sec_uuid = uuid.UUID(section_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid section_id UUID format")

    section = db.query(GeneratedSection).filter(GeneratedSection.id == sec_uuid).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    require_company_access(current_user, section.company_id)
    require_financial_section(section.section_name)
    require_not_locked(section)

    role = "finance_clarification" if req.request_clarification else "finance_comment"
    db.add(ChatMessage(section_id=section.id, role=role, content=note))
    db.add(AuditLog(
        event_type="finance_clarification_requested" if req.request_clarification else "finance_comment",
        company_id=section.company_id,
        section_name=section.section_name,
        query=note[:500],
        model_used="none",
    ))
    db.commit()

    return {"section_id": section_id, "role": role}


@router.get("/sections/{section_id}/comments")
def list_finance_comments(
    section_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Finance/CA comments + clarification requests on a section, oldest first."""
    try:
        sec_uuid = uuid.UUID(section_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid section_id UUID format")

    section = db.query(GeneratedSection).filter(GeneratedSection.id == sec_uuid).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    require_company_access(current_user, section.company_id)

    notes = db.query(ChatMessage).filter(
        ChatMessage.section_id == section.id,
        ChatMessage.role.in_(["finance_comment", "finance_clarification"]),
    ).order_by(ChatMessage.created_at.asc()).all()

    return {
        "section_id": section_id,
        "notes": [
            {
                "id": str(n.id),
                "text": n.content,
                "flagged": n.role == "finance_clarification",
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes
        ],
    }


@router.get("/{company_id}/clarifications")
def list_company_clarifications(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Company-wide feed of Finance/CA clarification requests, newest first.

    No existing Founder-facing comment feed exists to reuse — Review.jsx's
    saved notes are local to the Merchant Banker Workspace screen only and
    are not surfaced to the Founder anywhere. This is a new, minimal read
    endpoint so screens/Dashboard.jsx can show Finance/CA's flagged
    requests to the Founder.
    """
    require_company_access(current_user, company_id)
    comp_uuid = uuid.UUID(company_id)

    rows = (
        db.query(ChatMessage, GeneratedSection.section_name)
        .join(GeneratedSection, ChatMessage.section_id == GeneratedSection.id)
        .filter(
            GeneratedSection.company_id == comp_uuid,
            ChatMessage.role == "finance_clarification",
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(20)
        .all()
    )

    return {
        "clarifications": [
            {
                "id": str(msg.id),
                "section_name": section_name,
                "text": msg.content,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            }
            for msg, section_name in rows
        ],
    }


@router.post("/sections/{section_id}/finance-review")
def finance_review_section(
    section_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Finance/CA's approval of a financial section's figures.

    Deliberately separate from locking_router.py's POST
    /api/sections/{id}/approve (the Merchant Banker/Promoter's binding
    regulatory certification, which sets is_locked=True). This endpoint
    never sets is_locked — Finance/CA verifies financial content, it does
    not certify the filing — so it can never be used to unlock or override
    a Merchant Banker's certification, and /approve's existing behavior for
    other roles is completely untouched (this is a new endpoint, not an
    edit to that one).
    """
    require_finance_ca(current_user)

    try:
        sec_uuid = uuid.UUID(section_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid section_id UUID format")

    section = db.query(GeneratedSection).filter(GeneratedSection.id == sec_uuid).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    require_company_access(current_user, section.company_id)
    require_financial_section(section.section_name)
    require_not_locked(section)

    section.status = "finance_verified"

    db.add(AuditLog(
        event_type="section_finance_verified",
        company_id=section.company_id,
        section_name=section.section_name,
        query=f"finance_verified_by={current_user.get('sub') or current_user.get('company_id')}",
        model_used="none",
    ))
    db.commit()

    return {"section_id": section_id, "status": section.status}
