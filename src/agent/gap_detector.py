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
    
    # Pattern 1: Explicit ⚠️ GAP: markers — these are the primary, authoritative gap signals
    pattern1 = re.compile(r"(?:⚠️\s*)?GAP:\s*\[?([^,.\n⚠️\]]+)\]?", re.IGNORECASE)
    
    # Bug 4 Fix: Pattern 2 now uses a negative lookahead to EXCLUDE known citation formats.
    # Valid citations contain a pipe '|' character: [Reg 14 | ICDR 2018] or [Company DRHP | Section | Year]
    # We also exclude short bracket content that is clearly a cross-reference (e.g., [See Section 3]).
    # Only match brackets that look like unfilled placeholders: [Insert Company Name], [Date Here], etc.
    CITATION_KEYWORDS = {"icdr", "drhp", "reg", "regulation", "section", "schedule", "see"}
    pattern2 = re.compile(r"\[([^|\]\n]{4,60})\]")  # 4-60 chars, no pipe = not a citation
    
    explicit_gaps = pattern1.findall(draft_text)
    bracket_candidates = pattern2.findall(draft_text)
    
    # Filter out bracket matches that are citations or cross-references by keyword
    filtered_bracket_gaps = []
    for match in bracket_candidates:
        lower_match = match.strip().lower()
        # Skip if it starts with or contains any known citation keyword
        if any(lower_match.startswith(kw) or f" {kw}" in lower_match for kw in CITATION_KEYWORDS):
            continue
        filtered_bracket_gaps.append(match)
    
    # Combine and deduplicate — explicit GAP markers take priority
    all_matches = list(set(explicit_gaps + filtered_bracket_gaps))
    
    for match in all_matches:
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
