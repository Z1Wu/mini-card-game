PRESET_USERS = {
    "player1": {"password": "password1", "name": "玩家1"},
    "player2": {"password": "password2", "name": "玩家2"},
    "player3": {"password": "password3", "name": "玩家3"},
    "player4": {"password": "password4", "name": "玩家4"},
    "player5": {"password": "password5", "name": "玩家5"},
    "player6": {"password": "password6", "name": "玩家6"},
}

def authenticate_user(username: str, password: str) -> bool:
    user = PRESET_USERS.get(username)
    if not user:
        return False
    return user["password"] == password

def get_user_name(username: str) -> str:
    user = PRESET_USERS.get(username)
    if not user:
        return None
    return user["name"]

def get_all_usernames() -> list:
    return list(PRESET_USERS.keys())
