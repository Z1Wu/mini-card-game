import asyncio
from websocket.server import GameWebSocketServer
from config import Config

async def main():
    server = GameWebSocketServer(host=Config.HOST, port=Config.PORT)
    await server.start()

if __name__ == "__main__":
    asyncio.run(main())
