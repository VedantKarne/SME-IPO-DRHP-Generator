from fastapi import APIRouter, HTTPException, Depends
import uuid
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date
from src.extraction.schema import Company, FinancialStatement, DirectorKMP, OfferDetails

router = APIRouter(prefix="/api/wizard", tags=["wizard"])

# Dependency to get DB session (placeholder, will be overridden in main app)
def get_db():
    pass

class CompanyCreate(BaseModel):
    cin: str = Field(..., max_length=21)
    name: str
    incorporation_date: Optional[date] = None
    registered_office: Optional[str] = None
    business_activity_nic: Optional[str] = Field(None, max_length=10)

class FinancialStatementCreate(BaseModel):
    fiscal_year: int
    revenue_lakhs: Optional[float] = None
    ebitda_lakhs: Optional[float] = None
    pat_lakhs: Optional[float] = None
    net_worth_lakhs: Optional[float] = None
    paid_up_capital_lakhs: Optional[float] = None

class DirectorCreate(BaseModel):
    name: str
    din: Optional[str] = Field(None, max_length=8)
    designation: Optional[str] = None
    past_conviction: bool = False
    pending_litigation: bool = False
    litigation_details: Optional[str] = None

class OfferCreate(BaseModel):
    total_shares_offered: int
    price_per_share: float
    objects_of_offer: List[str] = []

@router.post("/company")
def create_company(company: CompanyCreate, db: Session = Depends(get_db)):
    db_company = db.query(Company).filter(Company.cin == company.cin).first()
    if db_company:
        raise HTTPException(status_code=400, detail="Company with this CIN already exists")
    
    new_company = Company(
        cin=company.cin,
        name=company.name,
        incorporation_date=company.incorporation_date,
        registered_office=company.registered_office,
        business_activity_nic=company.business_activity_nic
    )
    db.add(new_company)
    db.commit()
    db.refresh(new_company)
    return {"id": str(new_company.id), "message": "Company created successfully"}

@router.post("/financials/{company_id}")
def add_financials(company_id: uuid.UUID, financials: List[FinancialStatementCreate], db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    for fin in financials:
        db_fin = FinancialStatement(
            company_id=company_id,
            fiscal_year=fin.fiscal_year,
            revenue_lakhs=fin.revenue_lakhs,
            ebitda_lakhs=fin.ebitda_lakhs,
            pat_lakhs=fin.pat_lakhs,
            net_worth_lakhs=fin.net_worth_lakhs,
            paid_up_capital_lakhs=fin.paid_up_capital_lakhs
        )
        db.add(db_fin)
    db.commit()
    return {"message": f"Added {len(financials)} financial statements"}

@router.post("/directors/{company_id}")
def add_directors(company_id: uuid.UUID, directors: List[DirectorCreate], db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
        
    for dir in directors:
        db_dir = DirectorKMP(
            company_id=company_id,
            name=dir.name,
            din=dir.din,
            designation=dir.designation,
            past_conviction=dir.past_conviction,
            pending_litigation=dir.pending_litigation,
            litigation_details=dir.litigation_details
        )
        db.add(db_dir)
    db.commit()
    return {"message": f"Added {len(directors)} directors/KMPs"}

@router.post("/offer/{company_id}")
def add_offer_details(company_id: uuid.UUID, offer: OfferCreate, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    total_issue_size = (offer.total_shares_offered * offer.price_per_share) / 100000.0 # Convert to lakhs
    
    db_offer = OfferDetails(
        company_id=company_id,
        total_shares_offered=offer.total_shares_offered,
        price_per_share=offer.price_per_share,
        total_issue_size_lakhs=total_issue_size,
        objects_of_offer=offer.objects_of_offer
    )
    db.add(db_offer)
    db.commit()
    return {"message": "Offer details added", "calculated_issue_size_lakhs": total_issue_size}
