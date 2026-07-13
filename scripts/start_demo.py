import uvicorn
import uuid
import os
import sys

# Add project root to sys.path so 'src' can be resolved
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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
    
    print("Generating mock sections for the demo...")
    sections = [
        GeneratedSection(
            company_id=company.id,
            section_name="Risk Factors",
            draft_text="The company operates in a highly competitive information technology sector, which is characterized by rapid technological advancements, evolving customer needs, and intense market rivalry. This competitive landscape poses a significant challenge to our business, as it may lead to downward pressure on our pricing, thereby adversely impacting our revenues and EBITDA margins. Furthermore, our revenue stream is concentrated, with our top 5 clients collectively accounting for approximately 60% of our total revenue. This customer concentration risk may expose us to potential losses or disruptions to our business if we are unable to retain these key clients or if their respective businesses experience any material adverse events. In addition to our domestic operations, we also have a significant export business, with a notable portion of our revenues being generated from exports to various countries, which subjects us to risks associated with foreign markets, including fluctuations in foreign exchange rates, trade policies, and geopolitical uncertainties. As a result, we are continually focused on diversifying our client base, enhancing our service offerings, and investing in strategic",
            status="intermediary_certified",
            is_locked=True,
            completeness_score=0.85,
            flagged_gaps=[],
            supporting_clause_ids=["ICDR_2018_Reg237"]
        ),
        GeneratedSection(
            company_id=company.id,
            section_name="Capital Structure",
            draft_text="The authorized share capital is ₹500 Lakhs divided into 50,00,000 equity shares of ₹10 each. The issued, subscribed, and paid-up capital is ₹50 Lakhs.",
            status="intermediary_certified",
            is_locked=True,
            completeness_score=0.94,
            flagged_gaps=[],
            supporting_clause_ids=["ICDR_2018_Reg233"]
        ),
        GeneratedSection(
            company_id=company.id,
            section_name="Objects of the Offer",
            draft_text="The net proceeds will be utilized for: 1. Working capital requirements (₹1000 Lakhs). 2. General corporate purposes (₹700 Lakhs). The deployment of the net proceeds is expected to be as per the following schedule: | Year | Working Capital Requirements | General Corporate Purposes | Total |\n|-------|------------------------------|----------------------------|-------|\n| Year 1 | ₹400 Lakhs | ₹233 Lakhs | ₹633 Lakhs |\n| Year 2 | ₹300 Lakhs | ₹233 ...",
            status="draft",
            is_locked=False,
            completeness_score=0.76,
            flagged_gaps=[{"clause": "ICDR_Reg241", "description": "Missing deployment schedule", "gap": "Missing deployment schedule"}],
            supporting_clause_ids=["ICDR_2018_Reg241"]
        ),
        GeneratedSection(
            company_id=company.id,
            section_name="Introduction",
            draft_text="INTRODUCTION TechServ Solutions Ltd (hereinafter referred to as \"the Company\") is proposing to undertake an initial public offering of its equity shares, hereinafter referred to as the \"Issue\", in accordance with the provisions of the Securities and...",
            status="draft",
            is_locked=False,
            completeness_score=0.40,
            flagged_gaps=[],
            supporting_clause_ids=[]
        ),
        GeneratedSection(
            company_id=company.id,
            section_name="Cover Page & General Information",
            draft_text="[DRAFT IN PROGRESS] The company proposes to open the issue...",
            status="draft",
            is_locked=False,
            completeness_score=0.00,
            flagged_gaps=[
                {"clause": "ICDR_Reg1", "description": "Issue details. Missing total issue size in lakhs.", "gap": "Issue details. Missing total issue size in lakhs."},
                {"clause": "ICDR_Reg2", "description": "Bankers names. Missing names of Bankers to the Issue.", "gap": "Bankers names. Missing names of Bankers to the Issue."},
                {"clause": "ICDR_Reg3", "description": "Broker name. Missing name of the broker.", "gap": "Broker name. Missing name of the broker."},
                {"clause": "ICDR_Reg4", "description": "Financial info not provided. Missing summary of financial information on the cover page.", "gap": "Financial info not provided. Missing summary of financial information on the cover page."}
            ] + [{"clause": f"ICDR_Reg_{i}", "description": f"Missing compliance document or detail #{i}.", "gap": f"Missing compliance document or detail #{i}."} for i in range(5, 29)],
            supporting_clause_ids=[]
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
