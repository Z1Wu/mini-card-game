import os
from dotenv import load_dotenv

load_dotenv()

# 认证用户配置文件路径，默认 backend/auth/users.json
_DEFAULT_AUTH_USERS_FILE = os.path.join(os.path.dirname(__file__), "auth", "users.json")

class Config:
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8765))
    MAX_PLAYERS = 6
    MIN_PLAYERS = 3
    PING_INTERVAL = 20
    PING_TIMEOUT = 20
    AUTH_USERS_FILE = os.getenv("AUTH_USERS_FILE", _DEFAULT_AUTH_USERS_FILE)
