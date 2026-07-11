# 🤖 Agent Orchestration

> **LangGraph StateGraph deep-dive** — 7-node pipeline, AgentState, self-correction loop, Human-in-the-Loop interrupt/resume, and prompt engineering.

---

## Overview

The agent is the core intelligence of Nirmaan AI. For each DRHP section, it:
1. Retrieves relevant regulatory requirements and precedent examples (parallel).
2. Fetches structured company data from the database.
3. Validates cross-field consistency.
4. Drafts the section using Groq Llama 3.3-70B.
5. Validates the draft for completeness (gap detection).
6. Self-corrects if the score is below threshold (up to 2 attempts).
7. Pauses for Human-in-the-Loop review before finalizing.

---

## Graph Topology

**File**: `src/agent/orchestrator.py`

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

builder = StateGraph(AgentState)

# Register nodes
builder.add_node("regulatory_retrieval", regulatory_retrieval_node)
builder.add_node("precedent_retrieval", precedent_retrieval_node)
builder.add_node("data_fetch", data_fetch_node)
builder.add_node("consistency_validator", consistency_validator_node)
builder.add_node("draft_generation", draft_generation_node)
builder.add_node("gap_validator", gap_validator_node)
builder.add_node("hitl_review", hitl_review_interrupt)

# Parallel fan-out from START
builder.add_edge(START, "regulatory_retrieval")
builder.add_edge(START, "precedent_retrieval")
builder.add_edge(START, "data_fetch")

# Fan-in: wait for all three before consistency check
builder.add_edge(
    ["regulatory_retrieval", "precedent_retrieval", "data_fetch"], 
    "consistency_validator"
)

# Linear flow: validator → draft → gap check
builder.add_edge("consistency_validator", "draft_generation")
builder.add_edge("draft_generation", "gap_validator")

# Conditional self-correction routing
builder.add_conditional_edges(
    "gap_validator",
    self_correction_router,
    {"draft_generation": "draft_generation", "hitl_review": "hitl_review"}
)

memory = MemorySaver()
graph = builder.compile(checkpointer=memory)
```

---

## AgentState Schema

```python
class AgentState(TypedDict):
    # Identity
    company_name: str
    current_section: str
    
    # Retrieved contexts (filled by retrieval nodes)
    regulatory_context: str    # Formatted RAG results from ICDR corpus
    precedent_context: str     # Formatted RAG results from DRHP corpus
    company_facts: str         # Formatted company data from SQLite
    
    # Validation
    consistency_errors: List[Dict[str, Any]]  # Cross-field error list
    
    # Draft
    draft_text: str            # Current section draft (markdown)
    human_feedback: str        # Feedback from HITL review
    status: str                # 'draft' | 'promoter_reviewed' | 'intermediary_certified'
    
    # Quality metrics
    completeness_score: float  # 0.0 to 1.0 (1.0 = no gaps)
    revisions: int             # Number of self-correction attempts
    gaps: List[Dict[str, Any]] # Detected gap list [{clause_id, description, is_critical}]
```

---

## Node Reference

### Node 1: `regulatory_retrieval_node`

```python
def regulatory_retrieval_node(state: AgentState) -> dict:
    context = rag_search(
        query=f"What are the ICDR requirements for {state['current_section']}?",
        corpus="regulatory",
        query_type="compliance",
        k=3
    )
    return {"regulatory_context": context}
```

- Generates a compliance-focused query from the section name.
- Retrieves 3 regulatory chunks (after reranking from 9 candidates).
- Returns formatted results with `[Reg X | ICDR 2018]` citation tags.

### Node 2: `precedent_retrieval_node`

```python
def precedent_retrieval_node(state: AgentState) -> dict:
    context = rag_search(
        query=f"Show me examples of the {state['current_section']} section.",
        corpus="precedent",
        query_type="precedent",
        k=3
    )
    return {"precedent_context": context}
```

- Retrieves real DRHP examples of the same section.
- Dense-search-dominant (0.65/0.35) to find semantically similar precedent text.

### Node 3: `data_fetch_node`

```python
def data_fetch_node(state: AgentState) -> dict:
    facts = get_company_data(state["company_name"])
    return {"company_facts": facts}
```

`get_company_data()` in `src/agent/tools.py` queries:
- `Company` table: CIN, name, incorporation date, registered office
- `FinancialStatement` table: 3-year Revenue, EBITDA, PAT, Net Worth
- `DirectorKMP` table: Director names, DINs, designations, litigation status

Returns a formatted plain-text string (not JSON) for direct LLM consumption.

### Node 4: `consistency_validator_node`

```python
def consistency_validator_node(state: AgentState) -> dict:
    errors = []
    # Example: flag negative net worth for Capital Structure section
    if state["current_section"] == "Capital Structure" and \
       "NetWorth=-" in state.get("company_facts", ""):
        errors.append({
            "field": "net_worth_lakhs",
            "fix": "Company has negative net worth. Eligibility may be compromised."
        })
    return {"consistency_errors": errors}
```

Currently implements one deterministic check. This node is designed to be extended with additional cross-field consistency validations (e.g., revenue/EBITDA arithmetic consistency, offer size vs. capital limit checks).

### Node 5: `draft_generation_node`

The most complex node — calls Groq to generate the section draft.

**Prompt construction:**

```python
user_prompt = f"""Draft the '{state['current_section']}' section.

REGULATORY CONTEXT:
{state.get('regulatory_context', 'None')}

PRECEDENT EXAMPLES:
{state.get('precedent_context', 'None')}

COMPANY FACTS:
{state.get('company_facts', 'None')}
"""

# On revision runs — append gap list for self-correction
if state.get("revisions", 0) > 0 and state.get("gaps"):
    user_prompt += f"\n\nSELF-CORRECTION GAP LIST:\n- " + "\n- ".join(gap_descriptions)

# On human feedback run — append feedback
if state.get("human_feedback"):
    user_prompt += f"\n\nHUMAN REVISION REQUEST:\n{state['human_feedback']}"
```

**System prompt** (`DRAFT_SECTION_SYSTEM_PROMPT` in `src/agent/prompts.py`):
```
You are an elite corporate lawyer and SEBI-compliant DRHP drafting assistant for SME IPOs.

CITATION RULES (MANDATORY):
- Regulatory claims: cite as [Reg {number} | ICDR 2018]
- Precedent examples: cite as [{Company} DRHP | {Section} | {Year}]
- If NO clause supports a mandatory claim, flag as: ⚠️ GAP: [description]

ANTI-HALLUCINATION (CRITICAL):
- Financial figures, names, dates: use ONLY values from company_facts
- If a value is absent, insert ⚠️ GAP: [field description]
- Do NOT infer, estimate, or round figures not explicitly provided

DRAFTING STYLE:
- Write in formal third-person corporate legal tone
- Match tone, complexity, and sub-heading structure of precedent examples
- For financial sections, present data narratively then in structured bullets
```

**Groq client** (`src/agent/groq_client.py`):
- `RateLimitAwareGroqClient` wraps the Groq SDK with `tenacity` retry logic.
- On `RateLimitError`: exponential backoff with jitter before retrying.
- `max_tokens=2500` per draft call.

### Node 6: `gap_validator_node`

```python
def gap_validator_node(state: AgentState) -> dict:
    score, gaps = flag_gaps(state["current_section"], state["draft_text"])
    gap_dicts = [{"clause_id": g.clause_id, "description": g.description, 
                  "is_critical": g.is_critical} for g in gaps]
    return {"completeness_score": score, "gaps": gap_dicts}
```

See [Gap Detection](#gap-detection) below for `flag_gaps()` internals.

### Conditional Router: `self_correction_router`

```python
def self_correction_router(state: AgentState) -> str:
    score = state.get("completeness_score", 1.0)
    revisions = state.get("revisions", 0)
    
    if score < 0.75 and revisions < 2:
        return "draft_generation"  # Route back for self-correction
    return "hitl_review"           # Proceed to human review
```

**Self-correction logic:**
- If `completeness_score < 0.75` AND fewer than 2 revisions attempted → re-draft.
- On re-draft, the gap list is injected into the prompt as "SELF-CORRECTION GAP LIST."
- Maximum 2 self-correction attempts to prevent infinite loops.
- After 2 attempts, even an incomplete draft proceeds to HITL (the human resolves remaining gaps).

### Node 7: `hitl_review_interrupt`

```python
def hitl_review_interrupt(state: AgentState):
    payload = {
        "view": "promoter",
        "company_name": state["company_name"],
        "section_name": state["current_section"],
        "draft_text": state["draft_text"],
        "consistency_errors": state.get("consistency_errors", [])
    }
    
    # LangGraph pauses execution here
    human_decision = interrupt(payload)
    
    # When resumed with Command(resume=decision):
    action = human_decision.get("action")
    if action == "approve":
        return Command(goto=END, update={"status": "promoter_reviewed"})
    elif action == "revise":
        feedback = human_decision.get("feedback", "Please revise.")
        return Command(goto="draft_generation", update={"human_feedback": feedback})
    else:
        return Command(goto=END, update={"status": "rejected"})
```

The `interrupt(payload)` call:
1. Serializes the current `AgentState` to `MemorySaver` (in-memory checkpoint).
2. Raises a LangGraph `GraphInterrupt` exception.
3. The calling code in `server.py` catches this exception and snapshots the state.

When the promoter submits their review via the frontend:
- `POST /api/hitl/{thread_id}/resume` with `{"action": "approve"}` or `{"action": "revise", "feedback": "..."}`
- The graph is resumed from the checkpoint via `graph.invoke(Command(resume=decision), config=config)`.

---

## Gap Detection (`src/agent/gap_detector.py`)

### Pattern Matching

The `flag_gaps()` function uses two regex patterns to detect missing information:

**Pattern 1** — Explicit GAP markers:
```python
pattern1 = re.compile(r"(?:⚠️\s*)?GAP:\s*\[?([^,.↵⚠️\]]+)\]?", re.IGNORECASE)
```
Matches: `⚠️ GAP: [Director's full address]` → extracts `Director's full address`

**Pattern 2** — Bracketed placeholders:
```python
pattern2 = re.compile(r"\[([^|\]\n]+)\]")
```
Matches `[Company DIN]`, `[Date of Incorporation]` — ignores `[Reg 229 | ICDR 2018]` (citations contain `|`).

### Completeness Scoring

```python
deduction = 0.1 * len(gaps)
completeness_score = max(0.0, 1.0 - deduction)
```

Each detected gap deducts 0.1 from the score. A draft with 5 gaps scores 0.5; a draft with 0 gaps scores 1.0.

### Plain-English Gap Explanation

`explain_gap_to_promoter()` uses Groq with a low-temperature prompt to translate technical gap descriptions into friendly user-facing messages:
```
Input:  "clause_id: ICDR_GAP_CAPITAL_STRUCTURE, description: DIN"
Output: "Please provide the Director Identification Number (DIN) for each director."
```

---

## API Integration (`src/api/server.py`)

### `POST /api/agent/run`

```python
@app.post("/api/agent/run")
def run_agent(request: AgentRunRequest):
    initial_state: AgentState = {
        "company_name": company.name,
        "current_section": request.section_name,
        "regulatory_context": "",
        "precedent_context": "",
        "company_facts": "",
        "consistency_errors": [],
        "draft_text": "",
        "human_feedback": "",
        "status": "draft",
        "completeness_score": 0.0,
        "revisions": 0,
        "gaps": []
    }
    
    thread_id = str(uuid.uuid4())  # Unique per run
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        result = graph.invoke(initial_state, config=config)
    except Exception as agent_error:
        # LangGraph raises GraphInterrupt at HITL node — normal!
        state_snapshot = graph.get_state(config)
        result = state_snapshot.values
    
    # Save draft + gaps to GeneratedSection table
    ...
```

The `try/except` pattern is intentional — LangGraph raises an exception at the `interrupt()` call. The server catches it, snapshots the state, extracts the draft text and gaps, and saves them to the database. The HITL pause is transparent to the frontend.

---

## LangGraph Memory & Checkpointing

`MemorySaver` stores graph state in memory (process lifetime). Each run is identified by a unique `thread_id` (UUID), allowing:
- Multiple concurrent agent runs (different sections generating simultaneously).
- Resume capability for HITL nodes.
- State inspection via `graph.get_state(config)`.

**Note**: `MemorySaver` does not persist across server restarts. For production, replace with `SqliteSaver` or `PostgresSaver` from `langgraph.checkpoint.sqlite`/`postgres`.

---

## Prompt Engineering Notes

### Anti-Hallucination Architecture

The system prompt enforces a strict "use only what you're given" rule:
- Financial figures → only from `company_facts` string.
- Regulatory citations → only from retrieved `regulatory_context` chunks.
- Precedent style → only mirror, never fabricate company names/events.

Any field not available in `company_facts` MUST be flagged as `⚠️ GAP: [description]`, not inferred.

### Two-Layer Prompt System

The `AGENT_SYNTHESIS_PROMPT` (Layer 2) in `prompts.py` acts as a final output enforcer for the overall agent synthesis:
- Preserves all `⚠️ GAP` markers verbatim (they must not be removed during synthesis).
- Preserves all citation tags exactly.
- Maintains exhaustive legal drafting style — no paraphrasing or shortening.
- If `completeness_score < 0.75`, re-triggers drafting (this instruction is a fallback for agent-level awareness).
