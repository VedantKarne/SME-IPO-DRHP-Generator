from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.extraction.db_session import SessionLocal
from src.extraction.schema import Company, GeneratedSection, ReadinessScore, UploadedDocument

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from src.api.auth_router import get_current_user


@router.get("/api/session/restore")
def restore_session(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    company_id_str = current_user.get("company_id")
    import uuid
    try:
        company_id = uuid.UUID(company_id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid company_id in token")

    company = db.query(Company).filter(Company.id == company_id).first()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    sections = db.query(GeneratedSection).filter(GeneratedSection.company_id == company_id).all()
    readiness = db.query(ReadinessScore).filter(ReadinessScore.company_id == company_id).order_by(ReadinessScore.created_at.desc()).first()
    docs = db.query(UploadedDocument).filter(UploadedDocument.company_id == company_id).all()
    
    # Use actual EligibilityEngine instead of mock
    from src.eligibility.checker import EligibilityEngine
    try:
        engine = EligibilityEngine(db)
        eligibility = engine.check_all(company_id_str).model_dump()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Eligibility check failed: {e}")
        eligibility = None
    from src.api.server import get_company_sections
    sections_data = get_company_sections(company_id_str, current_user)

    # Run consistency checks to expose them on the Dashboard
    from src.agent.consistency_checker import run_all_checks_by_id
    try:
        consistency_errors = run_all_checks_by_id(company_id=company_id_str, db=db)
        consistency = {
            "has_issues": len(consistency_errors) > 0,
            "issue_count": len(consistency_errors),
            "checks": consistency_errors,
        }
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Consistency check failed in session restore: {e}")
        consistency = {"has_issues": False, "issue_count": 0, "checks": []}

    return {
        "company_id": str(company.id),
        "company_name": company.name,
        "sections": sections_data,
        "eligibility": eligibility,
        "consistency": consistency,
        "readiness": {
            "score": readiness.overall_score if readiness else 0,
            "financial_readiness": readiness.financials_score if readiness else 0,
            "legal_readiness": readiness.legal_score if readiness else 0,
            "compliance_readiness": readiness.compliance_score if readiness else 0,
        },
        "uploaded_documents": [
            {
                "id": str(d.id),
                "filename": d.filename,
                "doc_type": d.doc_type,
                "status": d.status
            } for d in docs
        ]
    }

@router.post("/api/eligibility/run")
def run_eligibility_check(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    company_id_str = current_user.get("company_id")
    import uuid
    try:
        company_id = uuid.UUID(company_id_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid company_id in token")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    from src.eligibility.checker import EligibilityEngine
    try:
        engine = EligibilityEngine(db)
        eligibility = engine.check_all(company_id_str).model_dump()
        return {"status": "success", "eligibility": eligibility}
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Eligibility check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
