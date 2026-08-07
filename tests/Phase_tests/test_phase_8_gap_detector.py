import pytest
import sys, os
from unittest.mock import MagicMock
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.agent.gap_detector import Gap, flag_gaps, explain_gap_to_promoter

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
    assert gaps[0].description == "The company_facts is missing the post-issue paid up capital"
    assert gaps[1].description == "Missing auditor certification for FY24"
    assert gaps[0].clause_id == "ICDR_GAP_CAPITAL_STRUCTURE"

def test_explain_gap_to_promoter():
    """Validates explain_gap_to_promoter without a real Groq API call.

    The CI environment has no GROQ_API_KEY so we use a mock client.
    This tests the function logic (calls client.generate, returns a string)
    without any network dependency.
    """
    gap = Gap(
        clause_id="ICDR_2018_Reg229_2_a",
        description="EBITDA threshold not met. Missing audited P&L statements for last 3 years.",
    )

    mock_client = MagicMock()
    mock_client.generate.return_value = (
        "Dear Promoter, we need your audited P&L statements for the last 3 financial years "
        "to verify that the EBITDA threshold under ICDR Regulation 229(2)(a) is met."
    )

    explanation = explain_gap_to_promoter(gap, mock_client)

    # The function must return a non-trivial string
    assert isinstance(explanation, str)
    assert len(explanation) > 10
    # The mock must have been called exactly once (no silent fallbacks)
    mock_client.generate.assert_called_once()
    print(f"\nGenerated Explanation: {explanation}")
