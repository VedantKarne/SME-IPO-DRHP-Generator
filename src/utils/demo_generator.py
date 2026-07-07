from src.extraction.schema import Company, FinancialStatement, DirectorKMP, OfferDetails
import uuid
from datetime import date, timedelta
import random

class SyntheticPromoterGenerator:
    """
    Generates realistic mock data for end-to-end testing of the DRHP pipeline.
    """
    def generate(self, sector: str = "IT_Services") -> tuple[Company, list[FinancialStatement], list[DirectorKMP], OfferDetails]:
        company_id = uuid.uuid4()
        
        # 1. Mock Company
        # CIN format: U{NIC_CODE}YYYY{STATE_CODE}PLC{6DIGITS}
        nic_code = "72900" if sector == "IT_Services" else "00000"
        cin = f"U{nic_code}2018MHPLC{random.randint(100000, 999999)}"
        
        company = Company(
            id=company_id,
            cin=cin,
            name="TechServ Solutions Ltd",
            incorporation_date=date(2018, 4, 15),
            registered_office="123 Tech Park, Andheri East, Mumbai, Maharashtra 400069",
            business_activity_nic=nic_code,
            dynamic_checklist={"startup_certificate": True, "factory_license": False},
            source="synthetic_demo"
        )
        
        # 2. Mock Financials (3 years)
        # To pass eligibility: EBITDA >= 1Cr (100 Lakhs) in 2 of 3 years
        # Net worth >= 1Cr (100 Lakhs)
        financials = [
            FinancialStatement(
                id=uuid.uuid4(),
                company_id=company_id,
                fiscal_year=2022,
                revenue_lakhs=450.0,
                ebitda_lakhs=85.0, # < 100 Lakhs
                pat_lakhs=40.0,
                net_worth_lakhs=120.0,
                paid_up_capital_lakhs=50.0,
                source="synthetic_demo"
            ),
            FinancialStatement(
                id=uuid.uuid4(),
                company_id=company_id,
                fiscal_year=2023,
                revenue_lakhs=800.0,
                ebitda_lakhs=150.0, # >= 100 Lakhs
                pat_lakhs=90.0,
                net_worth_lakhs=210.0,
                paid_up_capital_lakhs=50.0,
                source="synthetic_demo"
            ),
            FinancialStatement(
                id=uuid.uuid4(),
                company_id=company_id,
                fiscal_year=2024,
                revenue_lakhs=1200.0,
                ebitda_lakhs=280.0, # >= 100 Lakhs
                pat_lakhs=160.0,
                net_worth_lakhs=370.0,
                paid_up_capital_lakhs=50.0,
                source="synthetic_demo"
            )
        ]
        
        # 3. Mock Directors
        directors = [
            DirectorKMP(
                id=uuid.uuid4(),
                company_id=company_id,
                name="Rahul Sharma",
                din="01234567",
                designation="Managing Director",
                past_conviction=False,
                pending_litigation=True, # Will trigger a gap/risk factor
                litigation_details="Civil dispute regarding property in Pune court."
            ),
            DirectorKMP(
                id=uuid.uuid4(),
                company_id=company_id,
                name="Priya Patel",
                din="07654321",
                designation="CFO",
                past_conviction=False,
                pending_litigation=False,
                litigation_details=""
            )
        ]
        
        # 4. Mock Offer Details
        # Post-issue paid-up capital must be <= 25Cr (2500 Lakhs)
        offer = OfferDetails(
            id=uuid.uuid4(),
            company_id=company_id,
            total_shares_offered=2000000, # 20 Lakh shares
            price_per_share=85.0,
            total_issue_size_lakhs=1700.0, # 20L * 85 = 1700 Lakhs (17Cr)
            objects_of_offer={"working_capital": 1000.0, "general_corporate": 700.0}
        )
        
        return company, financials, directors, offer
