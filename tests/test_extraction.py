import pytest
from unittest.mock import patch, MagicMock
from google.api_core.exceptions import ResourceExhausted
from src.extraction.kpi_extractor import extract_with_retry, ExtractionResult

# Dummy valid JSON that matches the ExtractionResult schema
DUMMY_GEMINI_RESPONSE = """
{
  "company_name": "TechCorp Ltd",
  "cin": "L12345MH2000PLC123456",
  "financials": [
    {
      "fiscal_year": 2024,
      "revenue_lakhs": 1500.5,
      "ebitda_lakhs": 300.0,
      "pat_lakhs": 150.0,
      "net_worth_lakhs": 500.0,
      "paid_up_capital_lakhs": 100.0,
      "data_confidence": "high"
    }
  ],
  "directors": [
    {
      "name": "Jane Doe",
      "din": "01234567",
      "designation": "Managing Director",
      "past_conviction": false,
      "pending_litigation": false,
      "litigation_details": null
    }
  ],
  "objects_of_offer": ["Funding working capital", "General corporate purposes"]
}
"""

@pytest.fixture
def mock_genai():
    with patch("src.extraction.kpi_extractor.genai") as mock:
        # Setup mock for upload_file
        mock_file = MagicMock()
        mock_file.name = "mock_file_name"
        mock.upload_file.return_value = mock_file
        
        # Setup mock for model and generate_content
        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = DUMMY_GEMINI_RESPONSE
        mock_model.generate_content.return_value = mock_response
        mock.GenerativeModel.return_value = mock_model
        
        yield mock

def test_extraction_success(mock_genai, tmp_path):
    """Test that extraction returns a valid Pydantic model."""
    # Create a dummy pdf file for testing
    dummy_pdf = tmp_path / "dummy.pdf"
    dummy_pdf.write_bytes(b"dummy pdf content")
    
    result = extract_with_retry(str(dummy_pdf))
    
    assert isinstance(result, ExtractionResult)
    assert result.company_name == "TechCorp Ltd"
    assert len(result.financials) == 1
    assert result.financials[0].revenue_lakhs == 1500.5
    assert result.financials[0].data_confidence == "high"

def test_retry_on_resource_exhausted(mock_genai, tmp_path):
    """Test that tenacity retries upon encountering ResourceExhausted."""
    dummy_pdf = tmp_path / "dummy_retry.pdf"
    dummy_pdf.write_bytes(b"dummy pdf content")
    
    mock_model = mock_genai.GenerativeModel.return_value
    mock_response = MagicMock()
    mock_response.text = DUMMY_GEMINI_RESPONSE
    
    # Make generate_content fail the first two times, then succeed
    mock_model.generate_content.side_effect = [
        ResourceExhausted("Rate limit exceeded"),
        ResourceExhausted("Rate limit exceeded"),
        mock_response
    ]
    
    result = extract_with_retry(str(dummy_pdf))
    
    assert isinstance(result, ExtractionResult)
    assert result.company_name == "TechCorp Ltd"
    # generate_content should have been called 3 times total
    assert mock_model.generate_content.call_count == 3
