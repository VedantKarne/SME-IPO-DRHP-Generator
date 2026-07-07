import os
from typing import Literal
from pydantic import BaseModel
import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.api_core.exceptions import ResourceExhausted

# Make sure GEMINI_API_KEY is available or loaded
from dotenv import load_dotenv
load_dotenv()

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

class FinancialStatement(BaseModel):
    fiscal_year: int
    revenue_lakhs: float | None
    ebitda_lakhs: float | None
    pat_lakhs: float | None
    net_worth_lakhs: float | None
    paid_up_capital_lakhs: float | None
    data_confidence: Literal["high", "medium", "low"]

class DirectorKMP(BaseModel):
    name: str
    din: str | None
    designation: str | None
    past_conviction: bool
    pending_litigation: bool
    litigation_details: str | None

class ExtractionResult(BaseModel):
    company_name: str
    cin: str | None
    financials: list[FinancialStatement]
    directors: list[DirectorKMP]
    objects_of_offer: list[str]

def extract_from_uploaded_document(file_path: str) -> ExtractionResult:
    """Extracts structured financial and corporate data from a PDF document using Gemini 2.5 Flash."""
    model = genai.GenerativeModel(
        "gemini-2.5-flash",
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=ExtractionResult
        )
    )
    
    # Upload the file to Gemini API
    with open(file_path, "rb") as f:
        doc = genai.upload_file(f, mime_type="application/pdf")
        
    try:
        prompt = (
            "Extract all financial, corporate, director, and offer information from this document. "
            "Ensure you find 3 years of financial statements. Look for litigation and past convictions for directors."
        )
        response = model.generate_content([prompt, doc])
        
        # Pydantic validation
        return ExtractionResult.model_validate_json(response.text)
    finally:
        # Clean up the uploaded file to avoid clutter in the Gemini API project
        genai.delete_file(doc.name)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=60),
    retry=retry_if_exception_type(ResourceExhausted)
)
def extract_with_retry(file_path: str) -> ExtractionResult:
    """Wraps extraction with tenacity retry logic for Rate Limits."""
    return extract_from_uploaded_document(file_path)
