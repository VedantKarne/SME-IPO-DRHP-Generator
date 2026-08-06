import logging
from typing import TypedDict, List, Dict, Any, Optional, Annotated
import operator
from langgraph.graph import StateGraph, START, END
from langgraph.types import interrupt, Command

from src.agent.tools import rag_search, RetrievalUnavailable, get_company_data, get_client_document_context
from src.agent.prompts import DRAFT_SECTION_SYSTEM_PROMPT
from src.agent.groq_client import get_groq_client  # Bug 3 Fix: use singleton getter

logger = logging.getLogger(__name__)

class AgentState(TypedDict):
    company_name: str
    company_id: str          # UUID string — used to filter client_documents in Vector Store
    current_section: str
    
    # Contexts — use Annotated[str, operator.add] so parallel node updates
    # are safely merged rather than one overwriting the other.
    regulatory_context: str
    precedent_context: str
    company_facts: str
    
    # Validation
    consistency_errors: List[Dict[str, Any]]
    # True when the checker itself failed, so consistency_errors == [] means
    # "unknown", not "clean". Distinguishing these matters on a filing document.
    consistency_check_failed: bool
    consistency_check_error: str
    # Same distinction for retrieval: an empty context because nothing matched is
    # not the same as an empty context because retrieval was unavailable.
    regulatory_retrieval_failed: bool
    precedent_retrieval_failed: bool
    # Separate keys per corpus: these two nodes run in parallel, and LangGraph
    # rejects two concurrent writes to the same key in a single step.
    regulatory_retrieval_error: str
    precedent_retrieval_error: str
    
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
def _retrieve(label: str, **kwargs) -> tuple:
    """
    Run a retrieval and report whether it actually succeeded.

    Returns (context, failed, error). An empty context with failed=False means
    "the corpus was searched and matched nothing" — which is a different claim
    from "retrieval was unavailable", and the two must not be conflated on a
    document that carries regulatory citations.
    """
    try:
        context = rag_search(**kwargs)
    except RetrievalUnavailable as e:
        logger.error(f"{label} retrieval unavailable: {e}")
        return "", True, str(e)

    if not context.strip():
        logger.warning(f"{label} retrieval returned no matches — is the corpus indexed?")
    return context, False, ""


def regulatory_retrieval_node(state: AgentState) -> dict:
    logger.info(f"Retrieving regulatory context for {state['current_section']}...")
    context, failed, error = _retrieve(
        "Regulatory",
        query=f"What are the ICDR requirements for {state['current_section']}?",
        corpus="regulatory",
        query_type="compliance",
        k=3,
    )
    return {
        "regulatory_context": context,
        "regulatory_retrieval_failed": failed,
        "regulatory_retrieval_error": error,
    }

def precedent_retrieval_node(state: AgentState) -> dict:
    logger.info(f"Retrieving precedent context for {state['current_section']}...")
    context, failed, error = _retrieve(
        "Precedent",
        query=f"Show me examples of the {state['current_section']} section.",
        corpus="precedent",
        query_type="precedent",
        k=3,
    )
    return {
        "precedent_context": context,
        "precedent_retrieval_failed": failed,
        "precedent_retrieval_error": error,
    }

def data_fetch_node(state: AgentState) -> dict:
    logger.info(f"Fetching structured company facts and client document context for {state['company_name']}...")

    # 1. Structured DB facts (financials, directors, offer details)
    structured_facts = get_company_data(state["company_name"])

    # 2. Narrative context from uploaded client documents (Vector Store)
    company_id = state.get("company_id", "")
    section_name = state.get("current_section", "")
    narrative_context = ""
    if company_id:
        narrative_context = get_client_document_context(
            company_id=company_id,
            section_name=section_name,
            k=5
        )

    # Merge both into company_facts for the drafting prompt
    if narrative_context:
        combined = (
            f"{structured_facts}\n\n"
            f"UPLOADED DOCUMENT EXCERPTS (relevant to '{section_name}'):\n"
            f"{narrative_context}"
        )
    else:
        combined = structured_facts

    return {"company_facts": combined}

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

    from src.extraction.db_session import SessionLocal
    from src.agent.consistency_checker import run_all_checks

    db = SessionLocal()
    try:
        errors = run_all_checks(
            company_name=state["company_name"],
            db=db,
        )
    except Exception as e:
        # Do NOT return [] here. An empty error list is the same value the
        # checker returns when a document is fully consistent, so swallowing
        # the exception reported a crashed validator as a clean bill of health
        # — on a regulatory filing. Surface it as an explicit failure marker
        # so downstream consumers and the UI can tell "no issues found" apart
        # from "we could not check".
        logger.exception("Consistency validator failed")
        return {
            "consistency_errors": [],
            "consistency_check_failed": True,
            "consistency_check_error": str(e),
        }
    finally:
        db.close()

    return {"consistency_errors": errors, "consistency_check_failed": False}

def draft_generation_node(state: AgentState) -> dict:
    logger.info("Drafting section using Groq Llama 3.3 70B...")
    
    # Bug 3 Fix: Use the module-level singleton — no new object created on each call.
    client = get_groq_client()
    
    # Be explicit about *why* a context block is empty. Passing a bare "None"
    # for an unavailable corpus invites the model to supply regulation numbers
    # from memory, which then read as retrieved citations in the final document.
    def _context_block(value: str, failed: bool, label: str) -> str:
        if failed:
            return (f"[UNAVAILABLE — {label} retrieval failed. Do NOT cite any "
                    f"{label.lower()} source; state that the reference could not be verified.]")
        if not (value or "").strip():
            return (f"[EMPTY — no matching {label.lower()} material was found. Do NOT "
                    f"invent citations; draft only from the company facts below.]")
        return value

    regulatory_block = _context_block(
        state.get('regulatory_context', ''),
        state.get('regulatory_retrieval_failed', False),
        "Regulatory",
    )
    precedent_block = _context_block(
        state.get('precedent_context', ''),
        state.get('precedent_retrieval_failed', False),
        "Precedent",
    )

    user_prompt = f"""Draft the '{state['current_section']}' section.

REGULATORY CONTEXT:
{regulatory_block}

PRECEDENT EXAMPLES:
{precedent_block}

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

