from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/api/impact", tags=["Impact Analysis"])

class ImpactResponse(BaseModel):
    changed_field: str
    affected_sections: List[str]

# A deterministic mapping engine for the PS04 Hackathon
IMPACT_MAP = {
    "total_issue_size_lakhs": ["Capital Structure", "Objects of the Offer", "Basis of Issue Price"],
    "ebitda_lakhs": ["Basis of Issue Price", "Financial Statements (3 Years)", "Management Discussion & Analysis"],
    "litigation": ["Risk Factors", "Management & Board of Directors", "Outstanding Litigations and Material Developments"],
    "registered_office": ["General Information", "History and Corporate Structure"]
}

@router.get("/{changed_field}", response_model=ImpactResponse)
def calculate_impact(changed_field: str):
    """
    Detects rippling changes when core financial/offer data is modified.
    """
    # Normalize input
    field = changed_field.lower().strip()
    
    affected = IMPACT_MAP.get(field, [])
    
    return ImpactResponse(
        changed_field=field,
        affected_sections=affected
    )
