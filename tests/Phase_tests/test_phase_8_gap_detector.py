import pytest
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.agent.gap_detector import Gap, flag_gaps, explain_gap_to_promoter
from src.agent.groq_client import RateLimitAwareGroqClient

def test_flag_gaps_parsing():
    draft_text = """
    This is a generated section about the capital structure.
    ⚠️ GAP: The company_facts is missing the post-issue paid up capital.
    We need this to verify Reg 229(3).
    GAP: Missing auditor certification for FY24.
    """
    
    score, gaps = flag_gaps("Capital Structure", draft_text)
    
    # 2 gaps found -> 1.0 - (0.1 * 2) = 0.8
    assert len(gaps) == 2
    assert score == 0.8
    assert gaps[0].description == "The company_facts is missing the post-issue paid up capital."
    assert gaps[1].description == "Missing auditor certification for FY24."
    assert gaps[0].clause_id == "ICDR_GAP_CAPITAL_STRUCTURE"

def test_explain_gap_to_promoter():
    gap = Gap(clause_id="ICDR_2018_Reg229_2_a", description="EBITDA threshold not met. Missing audited P&L statements for last 3 years.")
    
    client = RateLimitAwareGroqClient()
    explanation = explain_gap_to_promoter(gap, client)
    
    # Check that it returns a string and is not empty
    assert isinstance(explanation, str)
    assert len(explanation) > 10
    
    # The language should be polite and ask for documents, not raw LLM output structure.
    print(f"\nGenerated Explanation: {explanation}")
