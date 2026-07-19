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
    server = RoomHubWebSocketServer(
        host=Config.HOST,
        port=Config.PORT,
        room_ttl_seconds=Config.ROOM_TTL_SECONDS,
    )
    await server.start()

if __name__ == "__main__":
    asyncio.run(main())
