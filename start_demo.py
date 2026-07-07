import uvicorn
import uuid
import os
from src.api.server import app, SessionLocal, engine
from src.utils.demo_generator import SyntheticPromoterGenerator
from src.extraction.schema import GeneratedSection, Company, Base

def setup_demo_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check if we already have the demo company
    existing = db.query(Company).filter(Company.name == "TechServ Solutions Ltd").first()
    if existing:
        print("Demo data already exists. Skipping generation.")
        db.close()
        return

    print("Generating Synthetic Promoter Data...")
    generator = SyntheticPromoterGenerator()
    company, financials, directors, offer = generator.generate()
    
    db.add(company)
    db.add_all(financials)
    db.add_all(directors)
    db.add(offer)
    db.commit()
    db.refresh(company)
    
    print("Generating 3 mock sections for the demo...")
    sections = [
        GeneratedSection(
            company_id=company.id,
            section_name="Risk Factors",
            draft_text="The company faces intense competition in the IT sector. This could adversely impact our revenues and EBITDA margins. We rely heavily on top 5 clients for 60% of our revenue.",
            status="draft",
            is_locked=False,
            completeness_score=0.85,
            supporting_clause_ids=["ICDR_2018_Reg237"]
        ),
        GeneratedSection(
            company_id=company.id,
            section_name="Capital Structure",
            draft_text="The authorized share capital is ₹500 Lakhs divided into 50,00,000 equity shares of ₹10 each. The issued, subscribed, and paid-up capital is ₹50 Lakhs.",
            status="intermediary_certified",
            is_locked=True,
            completeness_score=0.94,
            supporting_clause_ids=["ICDR_2018_Reg233"]
        ),
        GeneratedSection(
            company_id=company.id,
            section_name="Objects of the Offer",
            draft_text="The net proceeds will be utilized for: 1. Working capital requirements (₹1000 Lakhs). 2. General corporate purposes (₹700 Lakhs).",
            status="draft",
            is_locked=False,
            completeness_score=0.76,
            flagged_gaps=[{"clause": "ICDR_Reg241", "gap": "Missing deployment schedule"}],
            supporting_clause_ids=["ICDR_2018_Reg241"]
        )
    ]
    db.add_all(sections)
    db.commit()
    
    print(f"Successfully generated Demo Company ID: {company.id}")
    db.close()

if __name__ == "__main__":
    setup_demo_data()
    print("Starting FastAPI Backend for SEBI Hackathon Demo...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
