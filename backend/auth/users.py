"""
从配置文件加载用户列表，用于登录校验。
配置文件路径由 config.Config.AUTH_USERS_FILE 指定，默认为 auth/users.json。
格式：[ {"username": "xxx", "password": "xxx", "name": "显示名"}, ... ]
"""
import json
import logging

logger = logging.getLogger(__name__)

_USERS = {}  # username -> {"password": str, "name": str}


def _load_users():
    global _USERS
    if _USERS:
        return
    try:
        from config import Config
        path = Config.AUTH_USERS_FILE
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        _USERS = {}
        for item in data:
            u = item.get("username")
            if u:
                _USERS[u] = {
                    "password": item.get("password", ""),
                    "name": item.get("name") or u,
                }
        logger.info("Loaded %s users from %s", len(_USERS), path)
    except FileNotFoundError:
        logger.warning("Auth users file not found, no users allowed. Set AUTH_USERS_FILE or create auth/users.json")
        _USERS = {}
    except Exception as e:
        logger.error("Failed to load auth users file: %s", e)
        _USERS = {}


def authenticate_user(username: str, password: str) -> bool:
    _load_users()
    user = _USERS.get(username)
    if not user:
        return False
    return user["password"] == password


def get_user_name(username: str) -> str:
    _load_users()
    user = _USERS.get(username)
    if not user:
        return username
    return user["name"]


def get_all_usernames() -> list:
    _load_users()
    return list(_USERS.keys())
