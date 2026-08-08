from fastapi import APIRouter, Depends, HTTPException
from src.api.auth_router import get_current_user, require_company_access
from pydantic import BaseModel
from src.agent.tools import rag_search
from src.agent.groq_client import get_groq_client, LLMUnavailable

router = APIRouter(prefix="/api/copilot", tags=["Copilot"])

import uuid

class CopilotRequest(BaseModel):
    company_id: uuid.UUID
    current_section: str
    question: str

class CopilotResponse(BaseModel):
    answer: str
    citations: list[str]

COPILOT_SYSTEM_PROMPT = """You are Nirmaan — an expert IPO consultant and SEBI Merchant Banker AI. You have deep knowledge of SEBI ICDR Regulations 2018, the IPO preparation process for SME listings, and DRHP drafting.

PERSONALITY:
- Speak like a confident, experienced consultant — not like a search engine
- Be direct, clear, and helpful. Never say "according to the provided context"
- Use plain English first, then add regulatory details if needed
- Keep answers concise: 3–5 sentences max unless the question needs depth

WHEN ANSWERING:
- If you know the answer directly, answer it confidently from your knowledge
- Use the regulatory context provided to add specific clause citations where relevant
- Always end with a concrete, actionable tip if applicable
- Cite regulations as [Reg X | ICDR 2018] inline — do NOT list them separately

NEVER:
- Say "based on the context provided" or "according to the document"
- Give vague non-answers
- Add unnecessary caveats or disclaimers
"""

@router.post("/ask", response_model=CopilotResponse)
def ask_copilot(
    request: CopilotRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    General purpose IPO Copilot — answers regulatory questions,
    explains clauses, and helps improve DRHP sections.
    """
    require_company_access(current_user, str(request.company_id))


    # 1. Retrieve regulatory context to ground citations
    context = rag_search(
        query=request.question,
        corpus="both",
        query_type="compliance",
        k=3
    )

    # 2. Build prompt — context is used for citations, not as the sole source of truth
    user_prompt = (
        f"Current Section Being Reviewed: {request.current_section}\n\n"
        f"Regulatory Context (for citations only):\n{context}\n\n"
        f"User Question: {request.question}"
    )

    client = get_groq_client()
    messages = [
        {"role": "system", "content": COPILOT_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]

    try:
        answer = client.generate(messages, max_tokens=600)
    except LLMUnavailable as e:
        # Retryable outage, not a server bug — and the caller must not receive a
        # placeholder answer that reads like a real one.
        raise HTTPException(status_code=503, detail=str(e))

    import re
    citations = re.findall(r'\[Reg[^\]]+\]', answer)

    return CopilotResponse(answer=answer, citations=citations)
