import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8765))
    MAX_PLAYERS = 6
    MIN_PLAYERS = 3
    PING_INTERVAL = 20
    PING_TIMEOUT = 20
