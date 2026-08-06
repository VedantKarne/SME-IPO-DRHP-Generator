from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid
import logging

from src.extraction.schema import GeneratedSection
from src.agent.groq_client import get_groq_client, LLMUnavailable
from src.api.server import get_db
from src.api.auth_router import get_current_user, require_company_access

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/canvas", tags=["Canvas AI"])

class RewriteRequest(BaseModel):
    company_id: str
    section_name: str
    selected_text: str
    action: str

class PromptRequest(BaseModel):
    company_id: str
    section_name: str
    prompt: str
    full_text: str

class InlineAIRequest(BaseModel):
    company_id: str
    section_name: str
    instruction: str
    context_text: str

@router.post("/rewrite")
def rewrite_text(
    req: RewriteRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Rewrites a selected passage based on the predefined action (rewrite, expand, simplify, etc).
    """
    require_company_access(current_user, req.company_id)

    action_prompts = {
        "rewrite": "Please rewrite the following text for clarity and professional tone.",
        "expand": "Please expand the following text with more detail and context, keeping a professional tone.",
        "simplify": "Please simplify the following text so it is easy to understand without losing key facts.",
        "investor_friendly": "Please rewrite the following text to make it compelling and investor-friendly, highlighting strengths.",
        "professional": "Please rewrite the following text to sound extremely formal, legally precise, and professional.",
        "cite": "Please add relevant SEBI ICDR 2018 regulatory citations to the following text where appropriate."
    }
    
    instruction = action_prompts.get(req.action, "Please improve the following text.")
    
    system_prompt = (
        "You are an expert corporate lawyer drafting a SEBI DRHP document. "
        f"{instruction} "
        "CRITICAL: Output ONLY the revised text. Do not include any conversational filler like 'Here is the revised text' or quotes around the output."
    )
    
    client = get_groq_client()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": req.selected_text}
    ]
    
    try:
        new_text = client.generate(messages, max_tokens=1500)
        return {"proposed_text": new_text.strip()}
    except LLMUnavailable as e:
        # Breaker open or provider down: retryable, not a server bug.
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Groq rewrite failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/prompt")
def prompt_whole_doc(
    req: PromptRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Applies a custom user instruction to the entire section text and updates the database.
    """
    require_company_access(current_user, req.company_id)

    system_prompt = (
        "You are an expert corporate lawyer drafting a SEBI DRHP document. "
        "You will be given the full text of a section and an instruction on how to modify it. "
        "Apply the instruction to the entire text. "
        "CRITICAL: Output ONLY the complete revised text in markdown format. Do not include conversational filler."
    )
    
    user_prompt = f"INSTRUCTION:\n{req.prompt}\n\nCURRENT TEXT:\n{req.full_text}"
    
    client = get_groq_client()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    try:
        new_text = client.generate(messages, max_tokens=4000)
        
        try:
            comp_uuid = uuid.UUID(req.company_id)
            section = db.query(GeneratedSection).filter(
                GeneratedSection.company_id == comp_uuid,
                GeneratedSection.section_name == req.section_name
            ).first()
            if section:
                section.draft_text = new_text
                db.commit()
        except Exception as db_e:
            logger.warning(f"Could not save prompt result to DB: {db_e}")
            
        return {"proposed_text": new_text.strip()}
    except LLMUnavailable as e:
        # Breaker open or provider down: retryable, not a server bug.
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Groq prompt failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/inline-ai")
def inline_ai(
    req: InlineAIRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Executes an inline AI command at the cursor position based on context.
    """
    require_company_access(current_user, req.company_id)

    system_prompt = (
        "You are an expert corporate lawyer drafting a SEBI DRHP document. "
        "You will be given some context text around the cursor and a specific instruction to apply at that position. "
        "Provide ONLY the text to be inserted or replaced based on the instruction. "
        "Do not include conversational filler."
    )
    
    user_prompt = f"INSTRUCTION: {req.instruction}\n\nCONTEXT:\n{req.context_text}"
    
    client = get_groq_client()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    try:
        new_text = client.generate(messages, max_tokens=1000)
        return {"proposed_text": new_text.strip()}
    except LLMUnavailable as e:
        # Breaker open or provider down: retryable, not a server bug.
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Groq inline-ai failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
