import asyncio
import logging
from websocket.server import GameWebSocketServer
from config import Config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

async def main():
    server = GameWebSocketServer(host=Config.HOST, port=Config.PORT)
    await server.start()

if __name__ == "__main__":
    asyncio.run(main())
