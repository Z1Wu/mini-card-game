"""In-memory admin session manager with TTL-based expiry."""
import logging
import secrets
import time
from typing import Optional

logger = logging.getLogger(__name__)


class AdminSessionManager:
    """Manages short-lived admin session tokens for the REST API."""

    def __init__(self, ttl_seconds: int = 3600):
        self._ttl = ttl_seconds
        # token -> (username, created_monotonic)
        self._sessions: dict[str, tuple[str, float]] = {}

    def create_session(self, username: str) -> str:
        """Create a new session token for *username* and return it."""
        token = secrets.token_urlsafe(32)
        self._sessions[token] = (username, time.monotonic())
        logger.info("Admin session created for %s", username)
        return token

    def validate_session(self, token: str) -> Optional[str]:
        """Return the username for *token*, or ``None`` if invalid/expired."""
        entry = self._sessions.get(token)
        if not entry:
            return None
        username, created = entry
        if time.monotonic() - created > self._ttl:
            del self._sessions[token]
            logger.info("Admin session for %s expired", username)
            return None
        return username

    def revoke_session(self, token: str) -> None:
        """Remove *token* from the session store if present."""
        if self._sessions.pop(token, None):
            logger.info("Admin session revoked")

    def cleanup_expired(self) -> int:
        """Remove all expired sessions. Returns the count removed."""
        now = time.monotonic()
        expired = [t for t, (_, created) in self._sessions.items() if now - created > self._ttl]
        for t in expired:
            del self._sessions[t]
        if expired:
            logger.info("Cleaned up %d expired admin sessions", len(expired))
        return len(expired)
