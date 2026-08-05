from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid

from src.extraction.schema import GeneratedSection, ChatMessage, Company
from src.agent.groq_client import RateLimitAwareGroqClient
from src.api.server import get_db
from src.api.auth_router import get_current_user, require_company_access

router = APIRouter(prefix="/api/canvas", tags=["Chat Edit"])

class ChatEditRequest(BaseModel):
    company_id: str
    section_name: str
    prompt: str

class ChatEditResponse(BaseModel):
    section_id: str
    new_draft_text: str

@router.post("/chat-edit", response_model=ChatEditResponse)
def chat_edit_section(
    request: ChatEditRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    1. Loads current draft_text using company_id and section_name.
    2. Checks if section is locked.
    3. Calls Groq Llama 3.3 to apply the user's edit.
    4. Updates draft_text and appends to chat_message.
    5. Returns new text.
    """
    require_company_access(current_user, request.company_id)

    try:
        comp_uuid = uuid.UUID(request.company_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid company_id UUID format")
        
    company = db.query(Company).filter(Company.id == comp_uuid).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    section = db.query(GeneratedSection).filter(
        GeneratedSection.company_id == comp_uuid,
        GeneratedSection.section_name == request.section_name
    ).first()
    
    if not section:
        raise HTTPException(status_code=404, detail="Section not found. Please generate it first.")
        
    if section.is_locked:
        raise HTTPException(status_code=403, detail="Section is approved and locked for editing")
        
    # Build prompt for Groq
    system_prompt = (
        "You are an expert corporate lawyer editing a specific section of a SEBI DRHP document. "
        "Your task is to apply the user's revision request to the provided draft text. "
        "CRITICAL: Output ONLY the revised text. Do not add conversational filler like 'Here is the revised text'."
    )
    
    user_prompt = f"Current Draft:\n{section.draft_text}\n\nUser Request: {request.prompt}\n\nPlease provide the complete revised text."
    
    client = RateLimitAwareGroqClient()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    new_draft = client.generate(messages, max_tokens=2500)
    
    # Save interaction to DB
    user_msg = ChatMessage(section_id=section.id, role="user", content=request.prompt)
    assistant_msg = ChatMessage(section_id=section.id, role="assistant", content=new_draft)
    
    db.add(user_msg)
    db.add(assistant_msg)
    
    # Update draft text
    section.draft_text = new_draft
    
    db.commit()
    
    return ChatEditResponse(
        section_id=str(section.id),
        new_draft_text=new_draft
    )
