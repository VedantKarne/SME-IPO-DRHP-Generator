import os
import time
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

from groq import Groq, RateLimitError
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

logger = logging.getLogger(__name__)

class RateLimitAwareGroqClient:
    def __init__(self, model: str = "llama-3.3-70b-versatile"):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            logger.warning("GROQ_API_KEY not set. Drafting may fail.")
        self.client = Groq(api_key=api_key)
        self.model = model

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception_type(RateLimitError),
        before_sleep=lambda retry_state: logger.warning(f"Groq Rate limit hit. Retrying in {retry_state.next_action.sleep}s...")
    )
    def _groq_generate(self, messages: List[Dict[str, str]], max_tokens: int = 4000) -> str:
        response = self.client.chat.completions.create(
            messages=messages,
            model=self.model,
            temperature=0.2, # Keep it low for legal drafting
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    def generate(self, messages: List[Dict[str, str]], max_tokens: int = 4000) -> str:
        """
        Drafts a DRHP section using Groq Llama 3.3 70B with automatic 
        exponential backoff handling for RateLimitErrors.
        """
        logger.info(f"Generating draft with {self.model} (Max Tokens: {max_tokens})")
        start_time = time.time()
        result = self._groq_generate(messages, max_tokens)
        elapsed = time.time() - start_time
        logger.info(f"Draft generation completed in {elapsed:.2f} seconds.")
        return result

# Bug 3 Fix: Module-level singleton — instantiated once at import time,
# shared across all LangGraph node calls and self-correction loops.
_groq_client_instance: Optional[RateLimitAwareGroqClient] = None

def get_groq_client() -> RateLimitAwareGroqClient:
    """Returns the shared singleton Groq client, initializing it on first call."""
    global _groq_client_instance
    if _groq_client_instance is None:
        _groq_client_instance = RateLimitAwareGroqClient()
    return _groq_client_instance

