import uuid
from typing import Dict, Any, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, BackgroundTasks
import uvicorn
import logging

from langgraph.types import Command
from src.agent.orchestrator import graph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SME IPO - LangGraph HITL API")

# In a real app, thread states would be tied to users/sessions in DB.
# For hackathon, we keep a simple in-memory dict of active thread_ids.
ACTIVE_THREADS: Dict[str, dict] = {}

class StartRequest(BaseModel):
    company_name: str
    section_name: str

class FeedbackRequest(BaseModel):
    action: str  # "approve", "revise", "reject"
    feedback: Optional[str] = None

@app.post("/api/start")
def start_workflow(req: StartRequest):
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    state = {
        "company_name": req.company_name,
        "current_section": req.section_name,
        "human_feedback": ""
    }
    
    # Start the graph in a non-blocking manner or wait for interrupt.
    # Since we want to reach the interrupt quickly for the demo, we invoke synchronously.
    # It will block until it hits the `interrupt()` in `hitl_review`.
    try:
        logger.info(f"Starting execution for thread {thread_id}...")
        for event in graph.stream(state, config=config):
            # We can stream events, but we just want to run until it pauses.
            pass
            
        ACTIVE_THREADS[thread_id] = config
        return {"status": "paused_for_review", "thread_id": thread_id}
        
    except Exception as e:
        logger.error(f"Execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pending_review/{thread_id}")
def get_pending_review(thread_id: str):
    if thread_id not in ACTIVE_THREADS:
        raise HTTPException(status_code=404, detail="Thread not found or not active")
        
    config = ACTIVE_THREADS[thread_id]
    state = graph.get_state(config)
    
    if not state.next:
        return {"status": "completed_or_not_paused"}
        
    # state.tasks contains the interrupts
    pending_tasks = state.tasks
    if not pending_tasks or not pending_tasks[0].interrupts:
        return {"status": "no_interrupts"}
        
    # Extract the payload we passed to interrupt()
    payload = pending_tasks[0].interrupts[0].value
    return {"status": "pending_review", "payload": payload}

@app.post("/api/submit_feedback/{thread_id}")
def submit_feedback(thread_id: str, req: FeedbackRequest):
    if thread_id not in ACTIVE_THREADS:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    config = ACTIVE_THREADS[thread_id]
    
    # Resume the graph by passing the feedback back into the interrupt
    resume_payload = {
        "action": req.action,
        "feedback": req.feedback
    }
    
    try:
        # We pass a Command(resume=...) via stream
        # In newer langgraph SDKs, this is how we resume an interrupt.
        for event in graph.stream(Command(resume=resume_payload), config=config):
            pass
            
        new_state = graph.get_state(config)
        
        if not new_state.next:
            return {"status": "completed", "final_state_status": new_state.values.get("status")}
        else:
            return {"status": "paused_again", "next_nodes": new_state.next}
            
    except Exception as e:
        logger.error(f"Failed to resume graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("src.api.hitl_server:app", host="0.0.0.0", port=8000, reload=True)
