"""
Pytest configuration.

src/api/auth_router.py raises at import time when JWT_SECRET_KEY is unset — it
used to fall back to a secret hardcoded in the source, which meant the shipped
key signed every real token. Tests need *a* key but must never depend on the
production one, so set a throwaway value before any application module loads.
"""
import os

os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-not-for-any-real-deployment")
