import asyncio
import logging
from websocket.hub import RoomHubWebSocketServer
from config import Config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

async def main():
    Config.validate_startup_configuration()
    server = RoomHubWebSocketServer(
        host=Config.HOST,
        port=Config.PORT,
        room_ttl_seconds=Config.ROOM_TTL_SECONDS,
        origins=Config.ALLOWED_ORIGINS,
        max_messages_per_second=Config.MAX_MESSAGES_PER_SECOND,
        allow_legacy_join_game=Config.ALLOW_LEGACY_JOIN_GAME,
    )
    await server.start()

if __name__ == "__main__":
    asyncio.run(main())
