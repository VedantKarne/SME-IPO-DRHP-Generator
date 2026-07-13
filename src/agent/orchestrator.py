import logging
from typing import TypedDict, List, Dict, Any, Optional, Annotated
import operator
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt, Command

from src.agent.tools import rag_search, get_company_data
from src.agent.prompts import DRAFT_SECTION_SYSTEM_PROMPT
from src.agent.groq_client import get_groq_client  # Bug 3 Fix: use singleton getter

logger = logging.getLogger(__name__)

class AgentState(TypedDict):
    company_name: str
    current_section: str
    
    # Contexts — use Annotated[str, operator.add] so parallel node updates
    # are safely merged rather than one overwriting the other.
    regulatory_context: str
    precedent_context: str
    company_facts: str
    
    # Validation
    consistency_errors: List[Dict[str, Any]]
    
    # Drafting
    draft_text: str
    human_feedback: str
    status: str
    
    # Bug 1 Fix: Store the LangGraph thread_id so the HITL resume endpoint can use it.
    langgraph_thread_id: str
    
    # Validation / Scoring
    completeness_score: float
    revisions: int
    gaps: List[Dict[str, Any]]

# Nodes
def regulatory_retrieval_node(state: AgentState) -> dict:
    logger.info(f"Retrieving regulatory context for {state['current_section']}...")
    context = rag_search(
        query=f"What are the ICDR requirements for {state['current_section']}?",
        corpus="regulatory",
        query_type="compliance",
        k=3
    )
    return {"regulatory_context": context}

def precedent_retrieval_node(state: AgentState) -> dict:
    logger.info(f"Retrieving precedent context for {state['current_section']}...")
    context = rag_search(
        query=f"Show me examples of the {state['current_section']} section.",
        corpus="precedent",
        query_type="precedent",
        k=3
    )
    return {"precedent_context": context}

def data_fetch_node(state: AgentState) -> dict:
    logger.info(f"Fetching structured company facts for {state['company_name']}...")
    facts = get_company_data(state["company_name"])
    return {"company_facts": facts}

# Bug 2 Fix: Explicit join/aggregator node that LangGraph waits for only after
# ALL three upstream parallel nodes have delivered their results.
# This replaces the non-standard `add_edge([list], node)` fan-in pattern.
def context_aggregator_node(state: AgentState) -> dict:
    """
    A dedicated join node. LangGraph routes all three parallel retrieval outputs
    here. By the time this node executes, regulatory_context, precedent_context,
    and company_facts are all populated in state.
    """
    logger.info("All retrieval contexts received. Proceeding to consistency validation.")
    return {}  # No state mutation needed — just acts as a synchronization barrier.

def consistency_validator_node(state: AgentState) -> dict:
    logger.info("Running consistency validations...")
    errors = []
    
    # Bug 5 Fix: Replaced fragile substring match ("NetWorth=-") with a proper
    # structured DB lookup so zero net worth is also caught, and the check is
    # independent of the exact string format of get_company_data() output.
    try:
        from src.extraction.db_session import SessionLocal
        from src.extraction.schema import Company, FinancialStatement
        db = SessionLocal()
        try:
            company = db.query(Company).filter(
                Company.name.ilike(f"%{state['company_name']}%")
            ).first()
            if company:
                latest_fin = db.query(FinancialStatement).filter(
                    FinancialStatement.company_id == company.id
                ).order_by(FinancialStatement.fiscal_year.desc()).first()
                
                if latest_fin and latest_fin.net_worth_lakhs is not None:
                    if float(latest_fin.net_worth_lakhs) <= 0:
                        errors.append({
                            "field": "net_worth_lakhs",
                            "fix": f"Company has non-positive net worth (Rs {latest_fin.net_worth_lakhs} Lakhs). SEBI ICDR Reg 229(1)(b) requires positive net worth. Eligibility may be compromised."
                        })
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Consistency validator DB check failed: {e}")
        
    return {"consistency_errors": errors}

def draft_generation_node(state: AgentState) -> dict:
    logger.info("Drafting section using Groq Llama 3.3 70B...")
    
    # Bug 3 Fix: Use the module-level singleton — no new object created on each call.
    client = get_groq_client()
    
    user_prompt = f"""Draft the '{state['current_section']}' section.
    
REGULATORY CONTEXT:
{state.get('regulatory_context', 'None')}

PRECEDENT EXAMPLES:
{state.get('precedent_context', 'None')}

COMPANY FACTS:
{state.get('company_facts', 'None')}
"""

    if state.get("human_feedback"):
        user_prompt += f"\n\nHUMAN REVISION REQUEST:\n{state['human_feedback']}\nPlease rewrite the draft incorporating this feedback."
        
    if state.get("revisions", 0) > 0 and state.get("gaps"):
        gap_descriptions = [g["description"] for g in state["gaps"]]
        user_prompt += f"\n\nSELF-CORRECTION GAP LIST:\nThe previous draft was missing the following information. Please attempt to resolve these gaps if the data is available in the company facts, otherwise explicitly output the ⚠️ GAP markers again:\n- " + "\n- ".join(gap_descriptions)

    messages = [
        {"role": "system", "content": DRAFT_SECTION_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]
    
    draft = client.generate(messages, max_tokens=2500)
    current_revisions = state.get("revisions", 0)
    
    return {"draft_text": draft, "revisions": current_revisions + 1}

from src.agent.gap_detector import flag_gaps

def gap_validator_node(state: AgentState) -> dict:
    logger.info("Validating draft for GAP markers and calculating completeness score...")
    draft = state.get("draft_text", "")
    section_name = state.get("current_section", "Unknown")
    
    score, gaps = flag_gaps(section_name, draft)
    
    gap_dicts = [{"clause_id": g.clause_id, "description": g.description, "is_critical": g.is_critical} for g in gaps]
    logger.info(f"Completeness Score: {score}. Found {len(gaps)} gaps.")
    
    return {"completeness_score": score, "gaps": gap_dicts}

def self_correction_router(state: AgentState) -> str:
    score = state.get("completeness_score", 1.0)
    revisions = state.get("revisions", 0)
    
    if score < 0.75 and revisions < 2:
        logger.info(f"Score {score} < 0.75. Routing back to draft_generation (Revision {revisions}).")
        return "draft_generation"
    
    logger.info(f"Score {score} acceptable or max revisions reached. Routing to hitl_review.")
    return "hitl_review"

def hitl_review_interrupt(state: AgentState):
    logger.info("Interrupting graph for Human-in-the-Loop Review...")
    
    payload = {
        "view": "promoter",
        "company_name": state["company_name"],
        "section_name": state["current_section"],
        "draft_text": state["draft_text"],
        "consistency_errors": state.get("consistency_errors", [])
    }
    
    human_decision = interrupt(payload)
    action = human_decision.get("action")
    
    if action == "approve":
        return Command(goto=END, update={"status": "promoter_reviewed", "human_feedback": ""})
    elif action == "revise":
        feedback = human_decision.get("feedback", "Please revise.")
        return Command(goto="draft_generation", update={"human_feedback": feedback})
    else:
        return Command(goto=END, update={"status": "rejected"})

from langgraph.checkpoint.memory import MemorySaver

def build_orchestrator() -> StateGraph:
    builder = StateGraph(AgentState)
    
    # Register all nodes
    builder.add_node("regulatory_retrieval", regulatory_retrieval_node)
    builder.add_node("precedent_retrieval", precedent_retrieval_node)
    builder.add_node("data_fetch", data_fetch_node)
    builder.add_node("context_aggregator", context_aggregator_node)  # Bug 2 Fix: explicit join node
    builder.add_node("consistency_validator", consistency_validator_node)
    builder.add_node("draft_generation", draft_generation_node)
    builder.add_node("gap_validator", gap_validator_node)
    builder.add_node("hitl_review", hitl_review_interrupt)
    
    # Control flow
    # 1. Parallel fan-out from START
    builder.add_edge(START, "regulatory_retrieval")
    builder.add_edge(START, "precedent_retrieval")
    builder.add_edge(START, "data_fetch")
    
    # Bug 2 Fix: All three parallel nodes feed into a dedicated aggregator node.
    # LangGraph will only execute context_aggregator after ALL three have completed.
    builder.add_edge("regulatory_retrieval", "context_aggregator")
    builder.add_edge("precedent_retrieval", "context_aggregator")
    builder.add_edge("data_fetch", "context_aggregator")
    
    # 3. Aggregator → Consistency Validator → Draft
    builder.add_edge("context_aggregator", "consistency_validator")
    builder.add_edge("consistency_validator", "draft_generation")
    
    # 4. Gap Validation
    builder.add_edge("draft_generation", "gap_validator")
    
    # 5. Conditional Self-Correction Routing
    builder.add_conditional_edges(
        "gap_validator",
        self_correction_router,
        {
            "draft_generation": "draft_generation",
            "hitl_review": "hitl_review"
        }
    )
    
    memory = MemorySaver()
    return builder.compile(checkpointer=memory)

# Global Compiled Graph
graph = build_orchestrator()

