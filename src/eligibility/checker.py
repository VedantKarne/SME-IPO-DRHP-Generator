import logging
from typing import List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from src.extraction.schema import Company, FinancialStatement, DirectorKMP, OfferDetails

logger = logging.getLogger(__name__)

class CheckResult(BaseModel):
    name: str = Field(..., description="Name of the eligibility check")
    passed: bool = Field(..., description="True if the condition is met")
    mandatory: bool = Field(default=True, description="Whether this check is a hard requirement")
    clause_id: str = Field(..., description="The RAPTOR leaf node citation ID for this rule")
    reason: str = Field(..., description="Plain english explanation of the result")

class EligibilityReport(BaseModel):
    company_id: str
    company_name: str
    eligible: bool
    checks: List[CheckResult]
    regulatory_citations: List[str]

class EligibilityEngine:
    def __init__(self, db_session: Session):
        self.db = db_session

    def check_all(self, company_id: str) -> EligibilityReport:
        import uuid
        try:
            uid = uuid.UUID(company_id)
        except ValueError:
            raise ValueError(f"Invalid company_id format: {company_id}")

        company = self.db.query(Company).filter(Company.id == uid).first()
        if not company:
            raise ValueError(f"Company {company_id} not found in database.")
        
        financials = self.db.query(FinancialStatement).filter(
            FinancialStatement.company_id == uid
        ).order_by(FinancialStatement.fiscal_year.desc()).all()

        directors = self.db.query(DirectorKMP).filter(
            DirectorKMP.company_id == uid
        ).all()

        offer = self.db.query(OfferDetails).filter(
            OfferDetails.company_id == uid
        ).first()

        checks = [
            self._check_ebitda(financials),
            self._check_net_worth(financials),
            self._check_paid_up_capital(financials, offer),
            self._check_kmp_litigation(directors),
            self._check_no_winding_up(company)
        ]

        eligible = all(c.passed for c in checks if c.mandatory)
        citations = [c.clause_id for c in checks]

        return EligibilityReport(
            company_id=str(company.id),
            company_name=company.name,
            eligible=eligible,
            checks=checks,
            regulatory_citations=citations
        )

    def _check_ebitda(self, financials: List[FinancialStatement]) -> CheckResult:
        """≥₹1Cr in 2/3 years [Mar-2025 amendment]"""
        clause_id = "ICDR_2018_Reg229_2_a"
        
        if len(financials) < 3:
            return CheckResult(
                name="EBITDA Track Record",
                passed=False,
                clause_id=clause_id,
                reason="Company does not have 3 years of financial data."
            )
            
        years_above_1cr = sum(1 for f in financials[:3] if f.ebitda_lakhs and f.ebitda_lakhs >= 100.0)
        passed = years_above_1cr >= 2

        return CheckResult(
            name="EBITDA Track Record",
            passed=passed,
            clause_id=clause_id,
            reason=f"Operating profit ≥ ₹1 Cr in {years_above_1cr} out of the last 3 years." if passed else f"Only {years_above_1cr} out of 3 years met the ₹1 Cr EBITDA threshold."
        )

    def _check_net_worth(self, financials: List[FinancialStatement]) -> CheckResult:
        """Positive net worth [Reg 229(1)]"""
        clause_id = "ICDR_2018_Reg229_1_b"
        
        if not financials:
            return CheckResult(
                name="Positive Net Worth",
                passed=False,
                clause_id=clause_id,
                reason="No financial data available."
            )
            
        latest = financials[0]
        passed = bool(latest.net_worth_lakhs and latest.net_worth_lakhs > 0)
        
        return CheckResult(
            name="Positive Net Worth",
            passed=passed,
            clause_id=clause_id,
            reason=f"Latest net worth is positive (₹{latest.net_worth_lakhs} Lakhs)." if passed else "Latest net worth is negative or not provided."
        )

    def _check_paid_up_capital(self, financials: List[FinancialStatement], offer: OfferDetails) -> CheckResult:
        """≤₹25Cr post-issue [Reg 229(3)]"""
        clause_id = "ICDR_2018_Reg229_3"
        
        if not financials:
             return CheckResult(
                name="Post-Issue Paid-Up Capital",
                passed=False,
                clause_id=clause_id,
                reason="No financial data available."
            )

        latest_capital = financials[0].paid_up_capital_lakhs or 0.0
        # For prototype, assume face value = 10 if not given directly, or calculate via shares offered
        # If total_shares_offered is provided, assume face value 10:
        new_capital_lakhs = float(offer.total_shares_offered * 10 / 100000) if offer and offer.total_shares_offered else 0.0
        
        post_issue_capital = float(latest_capital) + new_capital_lakhs
        passed = post_issue_capital <= 2500.0 # 25 Cr = 2500 Lakhs

        return CheckResult(
            name="Post-Issue Paid-Up Capital",
            passed=passed,
            clause_id=clause_id,
            reason=f"Post-issue capital is ₹{post_issue_capital:.2f} Lakhs (Limit is ₹2500 Lakhs)." if passed else f"Post-issue capital ₹{post_issue_capital:.2f} Lakhs exceeds the ₹2500 Lakhs SME limit."
        )

    def _check_kmp_litigation(self, directors: List[DirectorKMP]) -> CheckResult:
        """KMP litigation [Mar-2025 amendment — new!]"""
        clause_id = "ICDR_2018_Mar2025_Amend_KMP"
        
        if not directors:
             return CheckResult(
                name="KMP Litigation Check",
                passed=True, # Assuming empty means no pending litigation known
                clause_id=clause_id,
                reason="No Key Managerial Personnel listed."
            )

        litigating_kmps = [d.name for d in directors if d.pending_litigation]
        passed = len(litigating_kmps) == 0

        return CheckResult(
            name="KMP Litigation Check",
            passed=passed,
            clause_id=clause_id,
            reason="No pending litigation against Key Managerial Personnel." if passed else f"Pending litigation found for KMP(s): {', '.join(litigating_kmps)}."
        )

    def _check_no_winding_up(self, company: Company) -> CheckResult:
        """[Reg 229(1)(c)]"""
        clause_id = "ICDR_2018_Reg229_1_c"
        
        # Check dynamic checklist or default to passed
        passed = True
        if company.dynamic_checklist and "winding_up_petition" in company.dynamic_checklist:
            passed = not company.dynamic_checklist["winding_up_petition"]

        return CheckResult(
            name="No Winding Up Petition",
            passed=passed,
            clause_id=clause_id,
            reason="No winding up petition pending against the company." if passed else "A winding up petition is pending against the company."
        )
