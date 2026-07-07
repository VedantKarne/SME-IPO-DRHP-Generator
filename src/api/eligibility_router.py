from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.extraction.db_session import get_db
from src.eligibility.checker import EligibilityEngine, EligibilityReport

router = APIRouter(prefix="/api/eligibility", tags=["Eligibility"])

@router.get("/{company_id}", response_model=EligibilityReport)
async def check_eligibility(company_id: str, db: Session = Depends(get_db)):
    """
    Evaluates SME IPO eligibility criteria for a given company.
    Returns a report detailing whether the company passed or failed specific SEBI ICDR rules.
    """
    engine = EligibilityEngine(db_session=db)
    try:
        report = engine.check_all(company_id)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")
