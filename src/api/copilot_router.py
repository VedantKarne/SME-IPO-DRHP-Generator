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

@router.post("/ask", response_model=CopilotResponse)
def ask_copilot(request: CopilotRequest):
    """
    General purpose chat that has access to the regulatory RAG corpus.
    Example: "Why is litigation disclosure required here?"
    """
    
    # 1. Retrieve regulatory context based on the user's question
    context = rag_search(
        query=request.question,
        corpus="regulatory",
        query_type="compliance",
        k=3
    )
    
    # 2. Generate a helpful explanation
    system_prompt = (
        "You are an expert SEBI Merchant Banker AI Copilot. "
        "Answer the user's question about DRHP drafting using ONLY the provided regulatory context. "
        "Be concise, plain English, and cite the specific ICDR regulations mentioned in the context."
    )
    
    user_prompt = f"Context:\n{context}\n\nQuestion: {request.question}"
    
    client = RateLimitAwareGroqClient()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    answer = client.generate(messages, max_tokens=1000)
    
    # Simple heuristic to extract citations for the frontend (or let the LLM do it)
    import re
    citations = re.findall(r'\[Reg[^\]]+\]', answer)
    
    return CopilotResponse(
        answer=answer,
        citations=citations
    )
