import sys
import os
import uuid
import logging
import json

sys.stdout.reconfigure(encoding='utf-8')

# Add project root to sys path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.agent.orchestrator import graph
from langgraph.types import Command

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("TestAgentFlow")

def main():
    print("="*60)
    print("🤖 SME IPO DRHP Generator - Agent Core Test")
    print("="*60)
    
    # We will test drafting the 'Capital Structure' section for a mocked company
    company = "Advit Jewels"
    section = "Capital Structure"
    
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    
    state = {
        "company_name": company,
        "current_section": section,
        "human_feedback": ""
    }
    
    print(f"\n🚀 Starting LangGraph execution for {company} - {section}...")
    print(f"Thread ID: {thread_id}\n")
    
    # Run until interrupt
    try:
        for event in graph.stream(state, config=config):
            # Print node transitions
            for node_name, node_output in event.items():
                print(f"✅ Node [{node_name}] executed.")
    except Exception as e:
        print(f"❌ Execution failed: {e}")
        return

    # Check if graph paused
    current_state = graph.get_state(config)
    if current_state.next:
        pending_tasks = current_state.tasks
        if pending_tasks and pending_tasks[0].interrupts:
            payload = pending_tasks[0].interrupts[0].value
            
            print("\n" + "="*60)
            print("⏸️ GRAPH INTERRUPTED FOR HUMAN REVIEW (HITL)")
            print("="*60)
            
            # Print any consistency errors found BEFORE drafting
            errors = payload.get("consistency_errors", [])
            if errors:
                print("\n⚠️ WARNING: Consistency Errors Detected BEFORE Drafting!")
                for err in errors:
                    print(f" - {err.get('fix')}")
                
            print("\n📄 DRAFT TEXT GENERATED:")
            print("-" * 40)
            print(payload.get("draft_text", "No draft text generated."))
            print("-" * 40)
            
            print("\nChoose an action:")
            print("1. Approve")
            print("2. Request Revision")
            print("3. Reject")
            
            choice = input("\nEnter choice (1/2/3): ").strip()
            
            if choice == "1":
                action = "approve"
                feedback = ""
            elif choice == "2":
                action = "revise"
                feedback = input("Enter revision instructions for the LLM: ")
            else:
                action = "reject"
                feedback = ""
                
            resume_payload = {"action": action, "feedback": feedback}
            
            print(f"\n▶️ Resuming graph with action: {action}...")
            
            for event in graph.stream(Command(resume=resume_payload), config=config):
                for node_name, node_output in event.items():
                    print(f"✅ Node [{node_name}] executed.")
                    
            final_state = graph.get_state(config)
            print("\n🎉 Workflow Completed!")
            print(f"Final Status: {final_state.values.get('status')}")
            
    else:
        print("Graph completed without hitting an interrupt.")

if __name__ == "__main__":
    main()
