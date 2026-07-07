from fastapi import APIRouter
from pydantic import BaseModel
from src.agent.tools import rag_search
from src.agent.groq_client import RateLimitAwareGroqClient

router = APIRouter(prefix="/api/copilot", tags=["Copilot"])

class CopilotRequest(BaseModel):
    company_id: str
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
def ask_copilot(request: CopilotRequest):
    """
    General purpose IPO Copilot — answers regulatory questions,
    explains clauses, and helps improve DRHP sections.
    """

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

    client = RateLimitAwareGroqClient()
    messages = [
        {"role": "system", "content": COPILOT_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]

    answer = client.generate(messages, max_tokens=600)

    import re
    citations = re.findall(r'\[Reg[^\]]+\]', answer)

    return CopilotResponse(answer=answer, citations=citations)
