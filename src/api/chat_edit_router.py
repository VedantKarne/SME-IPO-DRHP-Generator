from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid

from src.extraction.schema import GeneratedSection, ChatMessage
from src.agent.groq_client import RateLimitAwareGroqClient
# We assume there's a get_db dependency. We'll import it from server or create a local one.
# For now, we will import SessionLocal from server, but to avoid circular imports, it's better to pass it.
# Actually, we can define get_db in a common dependencies module, or just import it from where it's defined.
# In src/api/server.py, get_db is defined. We will import SessionLocal here directly for simplicity.
from src.api.server import get_db

router = APIRouter(prefix="/api/sections", tags=["Chat Edit"])

class ChatEditRequest(BaseModel):
    prompt: str

class ChatEditResponse(BaseModel):
    section_id: str
    new_draft_text: str

@router.post("/{section_id}/chat", response_model=ChatEditResponse)
def chat_edit_section(section_id: str, request: ChatEditRequest, db: Session = Depends(get_db)):
    """
    1. Loads current draft_text.
    2. Checks if section is locked.
    3. Calls Groq Llama 3.3 to apply the user's edit.
    4. Updates draft_text and appends to chat_message.
    5. Returns new text.
    """
    try:
        sec_uuid = uuid.UUID(section_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid section_id UUID format")
        
    section = db.query(GeneratedSection).filter(GeneratedSection.id == sec_uuid).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
        
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
