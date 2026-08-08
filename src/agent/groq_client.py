import os
import threading
import time
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

from groq import Groq, RateLimitError
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

logger = logging.getLogger(__name__)

# Circuit breaker. Exponential backoff already handles a transient rate limit,
# but when the provider is genuinely down every request still pays five retries
# with up to 60s waits before failing — so one outage stalls every user. After
# CB_FAILURE_THRESHOLD consecutive failures the breaker opens and calls fail
# immediately for CB_RESET_SECONDS, then a single probe decides whether to close.
CB_FAILURE_THRESHOLD = 4
CB_RESET_SECONDS = 60


class LLMUnavailable(RuntimeError):
    """Raised when the LLM is unreachable or the breaker is open."""


class _CircuitBreaker:
    def __init__(self, threshold: int = CB_FAILURE_THRESHOLD, reset_after: float = CB_RESET_SECONDS):
        self.threshold = threshold
        self.reset_after = reset_after
        self._failures = 0
        self._opened_at = 0.0
        self._lock = threading.Lock()

    @property
    def state(self) -> str:
        with self._lock:
            if self._failures < self.threshold:
                return "closed"
            return "half_open" if (time.time() - self._opened_at) >= self.reset_after else "open"

    def before_call(self) -> None:
        if self.state == "open":
            remaining = self.reset_after - (time.time() - self._opened_at)
            raise LLMUnavailable(
                f"LLM circuit breaker is open after {self._failures} consecutive "
                f"failures; retrying in {remaining:.0f}s."
            )

    def record_success(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at = 0.0

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            if self._failures == self.threshold:
                self._opened_at = time.time()
                logger.error(
                    f"LLM circuit breaker OPEN after {self._failures} consecutive failures; "
                    f"failing fast for {self.reset_after}s."
                )


class RateLimitAwareGroqClient:
    def __init__(self, model: str = "llama-3.1-8b-instant"):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            logger.warning("GROQ_API_KEY not set. Drafting may fail.")
        self.client = Groq(api_key=api_key)
        self.model = model
        self.breaker = _CircuitBreaker()

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception_type(RateLimitError),
        before_sleep=lambda retry_state: logger.warning(f"Groq Rate limit hit. Retrying in {retry_state.next_action.sleep}s...")
    )
    def _groq_generate(self, messages: List[Dict[str, str]], max_tokens: int = 3000, stream: bool = False):
        response = self.client.chat.completions.create(
            messages=messages,
            model=self.model,
            temperature=0.2, # Keep it low for legal drafting
            max_tokens=max_tokens,
            stream=stream,
        )
        if stream:
            return response
        return response.choices[0].message.content

    def generate(self, messages: List[Dict[str, str]], max_tokens: int = 3000, stream: bool = False):
        """
        Draft with exponential backoff on rate limits, behind a circuit breaker.

        Raises LLMUnavailable when the breaker is open or the call fails, rather
        than returning a placeholder string — a caller must be able to tell a
        failed generation from a real one.
        """
        self.breaker.before_call()

        logger.info(f"Generating draft with {self.model} (Max Tokens: {max_tokens}, Stream: {stream})")
        start_time = time.time()
        try:
            result = self._groq_generate(messages, max_tokens, stream=stream)
        except Exception as e:
            self.breaker.record_failure()
            raise LLMUnavailable(f"LLM request failed: {e}") from e

        if stream:
            # When streaming, we can't easily record success at the end here without wrapping the generator,
            # but we assume success if the initial call didn't fail.
            self.breaker.record_success()
            def generator_wrapper():
                try:
                    for chunk in result:
                        content = chunk.choices[0].delta.content
                        if content:
                            yield content
                finally:
                    elapsed = time.time() - start_time
                    self.last_latency_ms = int(elapsed * 1000)
            return generator_wrapper()

        self.breaker.record_success()
        elapsed = time.time() - start_time
        logger.info(f"Draft generation completed in {elapsed:.2f} seconds.")
        self.last_latency_ms = int(elapsed * 1000)
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

_fast_groq_client_instance: Optional[RateLimitAwareGroqClient] = None

def get_fast_groq_client() -> RateLimitAwareGroqClient:
    """Returns a shared singleton fast Groq client (e.g. 8B) for summarization and internal tasks."""
    global _fast_groq_client_instance
    if _fast_groq_client_instance is None:
        _fast_groq_client_instance = RateLimitAwareGroqClient(model="llama-3.1-8b-instant")
    return _fast_groq_client_instance

