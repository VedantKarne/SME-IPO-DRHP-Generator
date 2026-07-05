import os
import time
import json
from dotenv import load_dotenv

# To run this script, you will need to install the following packages:
# pip install google-generativeai groq openai python-dotenv

try:
    import google.generativeai as genai
    from groq import Groq
    from openai import OpenAI
except ImportError:
    print("❌ Missing dependencies. Please run: pip install google-generativeai groq openai python-dotenv")
    exit(1)

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY")

# ==============================================================================
# LARGE CONTEXT SIMULATION (approx 2,000 words / ~3,000 tokens)
# We simulate a large chunk of a DRHP Risk Factors section to test API limits.
# ==============================================================================

# A base paragraph of typical corporate DRHP risk factors
BASE_PARAGRAPH = """The Company operates in a highly competitive market subject to rapid technological changes. Our revenue is heavily dependent on three major clients who together account for 64% of our annual turnover. If any of these clients reduce their order volume or terminate their contracts, it could have a material adverse effect on our financial condition, results of operations, and cash flows. We also face foreign exchange risk as 45% of our raw materials are imported from overseas suppliers. However, we have not engaged in any active hedging strategies. Furthermore, our manufacturing facility in Gujarat is currently operating under an expired environmental clearance certificate, which we have applied to renew but have not yet received from the Ministry of Environment, Forest and Climate Change. There are two pending litigations against our Managing Director involving tax disputes from the year 2021, amounting to roughly 1.2 Crore INR. """

# Multiply the paragraph to simulate a very long document 
LARGE_CONTEXT = (BASE_PARAGRAPH * 15)

TEST_PROMPT = f"""
You are a SEBI Merchant Banker AI. Read the following Draft Risk Factors excerpt and evaluate it against SEBI ICDR Regulations.

DRAFT EXCERPT:
{LARGE_CONTEXT}

TASK:
Analyze the text and extract any severe legal or compliance risks. 
Output ONLY valid JSON in the exact following structure:
{{
  "completeness_score": 0.5,
  "flagged_gaps": [
    {{
      "risk_type": "Environmental",
      "description": "Details of the risk..."
    }}
  ]
}}
Do not include markdown formatting, backticks, or conversational text.
"""

def verify_json(response_text):
    try:
        parsed = json.loads(response_text.strip())
        # Check if expected keys are present
        if "completeness_score" in parsed and "flagged_gaps" in parsed:
            return "✅ Valid JSON & Correct Structure", parsed
        else:
            return "⚠️ Valid JSON but Missing Expected Keys", parsed
    except json.JSONDecodeError:
        return "❌ INVALID JSON (Failed strictness test)", response_text

def test_groq_model(model_name, description):
    print("\n" + "="*80)
    print(f"Testing Groq: {model_name}\n({description})")
    print("="*80)
    if not GROQ_API_KEY:
        print("❌ GROQ_API_KEY not found in environment (.env).")
        return
        
    try:
        client = Groq(api_key=GROQ_API_KEY)
        start_time = time.time()
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": TEST_PROMPT}],
            model=model_name,
            temperature=0.0
        )
        end_time = time.time()
        response_text = chat_completion.choices[0].message.content.strip()
        
        print(f"⏱️  Latency: {end_time - start_time:.2f} seconds")
        status, data = verify_json(response_text)
        print(f"📊 Strictness: {status}")
        print(f"📝 Raw Output (truncated): {response_text[:200]}...")
    except Exception as e:
        print(f"❌ API Error or Rate Limit Hit: {e}")

def test_gemini_model(model_name, description):
    print("\n" + "="*80)
    print(f"Testing Google Gemini: {model_name}\n({description})")
    print("="*80)
    if not GEMINI_API_KEY:
        print("❌ GEMINI_API_KEY not found in environment (.env).")
        return
    
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(model_name)
        start_time = time.time()
        response = model.generate_content(
            TEST_PROMPT,
            generation_config=genai.GenerationConfig(temperature=0.0)
        )
        end_time = time.time()
        response_text = response.text.strip()
        
        print(f"⏱️  Latency: {end_time - start_time:.2f} seconds")
        status, data = verify_json(response_text)
        print(f"📊 Strictness: {status}")
        print(f"📝 Raw Output (truncated): {response_text[:200]}...")
    except Exception as e:
        print(f"❌ API Error or Rate Limit Hit: {e}")

def test_cerebras_model(model_name, description):
    print("\n" + "="*80)
    print(f"Testing Cerebras: {model_name}\n({description})")
    print("="*80)
    if not CEREBRAS_API_KEY:
        print("❌ CEREBRAS_API_KEY not found in environment (.env).")
        return
        
    try:
        client = OpenAI(base_url="https://api.cerebras.ai/v1", api_key=CEREBRAS_API_KEY)
        start_time = time.time()
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": TEST_PROMPT}],
            model=model_name,
            temperature=0.0
        )
        end_time = time.time()
        response_text = chat_completion.choices[0].message.content.strip()
        
        print(f"⏱️  Latency: {end_time - start_time:.2f} seconds")
        status, data = verify_json(response_text)
        print(f"📊 Strictness: {status}")
        print(f"📝 Raw Output (truncated): {response_text[:200]}...")
    except Exception as e:
        print(f"❌ API Error or Rate Limit Hit: {e}")

if __name__ == "__main__":
    print("Starting LARGE CONTEXT LLM API Sandbox Tests...")
    print(f"Simulated Context Size: ~{len(TEST_PROMPT.split())} words (Testing TPM Rate Limits)")
    print("Focus: Token limits + JSON Strictness on heavy reasoning")
    
    test_gemini_model("gemini-2.5-flash", "Best for long PDFs / DRHP ingestion.")
    test_groq_model("openai/gpt-oss-120b", "Test as strongest free reasoning model.")
    test_groq_model("llama-3.3-70b-versatile", "Stable legal drafting baseline.")
    test_groq_model("qwen/qwen3-32b", "Good alternate reasoning model.")
    test_groq_model("meta-llama/llama-4-scout-17b-16e-instruct", "Add for document/multimodal experiments.")
    test_groq_model("llama-3.1-8b-instant", "Keep for intent routing, query classification.")
    test_cerebras_model("llama3.1-8b", "Latency benchmarking for raw speed.")
    
    print("\n" + "="*80)
    print("Tests complete! If any failed with 'Rate Limit' or 'Token Limit', they cannot handle large contexts on the free tier.")
