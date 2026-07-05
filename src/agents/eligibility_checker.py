from pydantic import BaseModel
from typing import List, Optional
from src.extraction.schema import Company, FinancialStatement, DirectorKMP

class EligibilityCheck(BaseModel):
    name: str
    passed: bool
    mandatory: bool = True
    clause_id: str
    details: str

class EligibilityReport(BaseModel):
    eligible: bool
    checks: List[EligibilityCheck]
    regulatory_citations: List[str]

class EligibilityEngine:
    def _check_ebitda(self, financials: List[FinancialStatement]) -> EligibilityCheck:
        # Check if EBITDA is >= Rs 1 Cr in at least 2 out of 3 years
        years_passed = sum(1 for f in financials if f.ebitda_lakhs and f.ebitda_lakhs >= 100)
        passed = years_passed >= 2
        return EligibilityCheck(
            name="EBITDA Track Record",
            passed=passed,
            clause_id="ICDR_2018_Reg229_2_a", # Mar-2025 amendment RAPTOR leaf
            details=f"EBITDA >= 1Cr in {years_passed}/3 years."
        )

    def _check_net_worth(self, financials: List[FinancialStatement]) -> EligibilityCheck:
        # Check if net worth is positive in the latest year
        latest = sorted(financials, key=lambda x: x.fiscal_year, reverse=True)
        if latest and latest[0].net_worth_lakhs and latest[0].net_worth_lakhs > 0:
            passed = True
            details = f"Latest net worth is positive (Rs {latest[0].net_worth_lakhs} Lakhs)."
        else:
            passed = False
            details = "Latest net worth is not positive or not provided."
            
        return EligibilityCheck(
            name="Positive Net Worth",
            passed=passed,
            clause_id="ICDR_2018_Reg229_1_a",
            details=details
        )
        
    def _check_kmp_litigation(self, directors: List[DirectorKMP]) -> EligibilityCheck:
        # No pending litigation for KMP
        litigated = [d.name for d in directors if d.pending_litigation]
        passed = len(litigated) == 0
        return EligibilityCheck(
            name="KMP Litigation Check",
            passed=passed,
            clause_id="ICDR_2018_Reg238_1_vi_amd", # Mar-2025
            details=f"Pending litigation found for: {', '.join(litigated)}" if not passed else "No pending litigation for KMPs."
        )

    def check_all(self, company: Company, financials: List[FinancialStatement], directors: List[DirectorKMP]) -> EligibilityReport:
        checks = [
            self._check_ebitda(financials),
            self._check_net_worth(financials),
            self._check_kmp_litigation(directors),
        ]
        
        eligible = all(c.passed for c in checks if c.mandatory)
        citations = [c.clause_id for c in checks]
        
        return EligibilityReport(
            eligible=eligible,
            checks=checks,
            regulatory_citations=citations
        )
