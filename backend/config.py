import os
from dotenv import load_dotenv

load_dotenv()

# 认证用户配置文件路径，默认 backend/auth/users.json
_DEFAULT_AUTH_USERS_FILE = os.path.join(os.path.dirname(__file__), "auth", "users.json")

class Config:
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8765))
    MAX_PLAYERS = 5
    MIN_PLAYERS = 3
    PING_INTERVAL = 20
    PING_TIMEOUT = 20
    ROOM_TTL_SECONDS = float(os.getenv("ROOM_TTL_SECONDS", 300))
    AUTH_USERS_FILE = os.getenv("AUTH_USERS_FILE", _DEFAULT_AUTH_USERS_FILE)
    _RAW_ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "")
    ALLOWED_ORIGINS = [origin.strip() for origin in _RAW_ALLOWED_ORIGINS.split(",") if origin.strip()] or None
    MAX_MESSAGES_PER_SECOND = int(os.getenv("MAX_MESSAGES_PER_SECOND", 30))
    ALLOW_LEGACY_JOIN_GAME = os.getenv("ALLOW_LEGACY_JOIN_GAME", "false").lower() in {"1", "true", "yes"}
