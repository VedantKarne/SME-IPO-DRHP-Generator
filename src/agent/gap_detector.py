import re
from typing import List, Tuple
from pydantic import BaseModel
from src.agent.groq_client import RateLimitAwareGroqClient

class Gap(BaseModel):
    clause_id: str
    description: str
    is_critical: bool = True

def flag_gaps(section_name: str, draft_text: str) -> Tuple[float, List[Gap]]:
    """
    Scans the draft_text for '⚠️ GAP:' markers and calculates a completeness score.
    Returns (completeness_score, list_of_gaps).
    """
    gaps = []
    
    # We look for "⚠️ GAP: [description]" in the text
    # It might also just say "GAP: [description]" depending on LLM output
    pattern = re.compile(r"(?:⚠️\s*)?GAP:\s*(.*?)(?=\n|$)", re.IGNORECASE)
    
    matches = pattern.findall(draft_text)
    
    for match in matches:
        description = match.strip()
        # Create a mock clause_id based on the section, or extract it if the LLM provided one.
        # For prototype simplicity, we generate a generic clause_id if none exists.
        clause_id = f"ICDR_GAP_{section_name.upper().replace(' ', '_')}"
        
        gaps.append(Gap(
            clause_id=clause_id,
            description=description,
            is_critical=True
        ))
    
    # Calculate completeness score
    # Baseline 1.0, subtract 0.1 for every gap, minimum 0.0
    deduction = 0.1 * len(gaps)
    completeness_score = max(0.0, 1.0 - deduction)
    
    return completeness_score, gaps

def explain_gap_to_promoter(gap: Gap, groq_client: RateLimitAwareGroqClient) -> str:
    """
    Convert technical ICDR gap into plain English for a non-expert promoter.
    Uses Groq with a low-temperature prompt.
    """
    system_prompt = (
        "You are a helpful legal assistant for an SME preparing for an IPO. "
        "Your job is to translate a technical regulatory missing data gap into a friendly, plain English request for the company's promoters. "
        "Do not use heavy legal jargon. Be extremely brief (1-3 sentences max). "
        "Directly ask the promoter to provide the specific document or information."
    )
    
    user_prompt = f"Technical Gap Clause: {gap.clause_id}\nDescription: {gap.description}\n\nTranslate this gap into a message for the promoter."
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    # Generate translation with low temperature for consistency
    explanation = groq_client.generate(
        messages=messages,
        max_tokens=250
    )
    
    return explanation.strip()
