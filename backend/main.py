import asyncio
import logging
from websocket.hub import RoomHubWebSocketServer
from admin.http_server import AdminHttpServer
from admin.sessions import AdminSessionManager
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
        rng_seed=Config.E2E_RANDOM_SEED,
        enable_e2e_scenarios=Config.ENABLE_E2E_SCENARIOS,
    )
    session_manager = AdminSessionManager(ttl_seconds=Config.ADMIN_SESSION_TTL)
    admin_http = AdminHttpServer(
        hub=server,
        session_manager=session_manager,
        host=Config.HOST,
        port=Config.ADMIN_HTTP_PORT,
        origins=Config.ALLOWED_ORIGINS,
        api_prefix=Config.ADMIN_API_PREFIX,
    )
    await asyncio.gather(server.start(), admin_http.start())

if __name__ == "__main__":
    asyncio.run(main())
