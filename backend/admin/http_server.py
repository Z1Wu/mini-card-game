"""aiohttp-based REST API server for admin operations.

Provides user CRUD, room monitoring, player kick, and full game-state inspection.
Runs alongside the existing WebSocket server in the same asyncio event loop,
sharing the RoomHubWebSocketServer instance for live state access.
"""
import asyncio
import json
import logging
from typing import Optional

from aiohttp import web

from admin.sessions import AdminSessionManager
from auth.users import (
    authenticate_user,
    get_user_name,
    get_all_users,
    is_admin,
    create_user,
    update_user,
    delete_user,
    admin_count,
)

logger = logging.getLogger(__name__)

DEFAULT_ROOM_CODE = "default"


class AdminHttpServer:
    """HTTP REST server exposing admin-only endpoints."""

    def __init__(
        self,
        hub,
        session_manager: AdminSessionManager,
        host: str = "0.0.0.0",
        port: int = 8766,
        origins: Optional[list[str]] = None,
        api_prefix: str = "/api/admin",
    ):
        self.hub = hub
        self.session_manager = session_manager
        self.host = host
        self.port = port
        self.origins = origins or []
        self.api_prefix = api_prefix.rstrip("/")
        self.app = web.Application(middlewares=[self._cors_middleware])
        self._setup_routes()

    # ------------------------------------------------------------------
    # Setup
    # ------------------------------------------------------------------

    def _setup_routes(self) -> None:
        p = self.api_prefix
        self.app.router.add_post(f"{p}/login", self._handle_login)
        self.app.router.add_post(f"{p}/logout", self._handle_logout)
        self.app.router.add_get(f"{p}/users", self._handle_list_users)
        self.app.router.add_post(f"{p}/users", self._handle_create_user)
        self.app.router.add_put(f"{p}/users/{{username}}", self._handle_update_user)
        self.app.router.add_delete(f"{p}/users/{{username}}", self._handle_delete_user)
        self.app.router.add_get(f"{p}/rooms", self._handle_list_rooms)
        self.app.router.add_delete(f"{p}/rooms/{{code}}", self._handle_close_room)
        self.app.router.add_delete(
            f"{p}/rooms/{{code}}/players/{{player_id}}", self._handle_kick_player
        )
        self.app.router.add_get(
            f"{p}/rooms/{{code}}/game-state", self._handle_game_state
        )
        self.app.router.add_get(f"{p}/stats", self._handle_stats)

    # ------------------------------------------------------------------
    # Middleware
    # ------------------------------------------------------------------

    @web.middleware
    async def _cors_middleware(self, request, handler):
        if request.method == "OPTIONS":
            response = web.Response(status=204)
        else:
            response = await handler(request)

        origin = request.headers.get("Origin", "")
        if self.origins and origin in self.origins:
            response.headers["Access-Control-Allow-Origin"] = origin
        elif not self.origins:
            response.headers["Access-Control-Allow-Origin"] = "*"

        response.headers["Access-Control-Allow-Methods"] = (
            "GET, POST, PUT, DELETE, OPTIONS"
        )
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Max-Age"] = "3600"
        return response

    # ------------------------------------------------------------------
    # Auth helpers
    # ------------------------------------------------------------------

    def _extract_token(self, request) -> Optional[str]:
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return None
        return auth[7:]

    async def _require_admin(self, request) -> Optional[str]:
        """Return the authenticated admin username, or ``None``."""
        token = self._extract_token(request)
        if not token:
            return None
        username = self.session_manager.validate_session(token)
        if not username or not is_admin(username):
            return None
        return username

    def _json_error(self, message: str, status: int) -> web.Response:
        return web.json_response({"error": message}, status=status)

    # ------------------------------------------------------------------
    # Endpoint: login
    # ------------------------------------------------------------------

    async def _handle_login(self, request: web.Request) -> web.Response:
        try:
            data = await request.json()
        except (json.JSONDecodeError, web.HTTPException):
            return self._json_error("Invalid JSON body", 400)

        username = data.get("username", "")
        password = data.get("password", "")
        if not username or not password:
            return self._json_error("Missing username or password", 400)

        if not authenticate_user(username, password):
            return self._json_error("Invalid credentials", 401)

        if not is_admin(username):
            return self._json_error("Admin access required", 403)

        token = self.session_manager.create_session(username)
        return web.json_response(
            {"token": token, "username": username, "name": get_user_name(username)}
        )

    # ------------------------------------------------------------------
    # Endpoint: logout
    # ------------------------------------------------------------------

    async def _handle_logout(self, request: web.Request) -> web.Response:
        token = self._extract_token(request)
        if token:
            self.session_manager.revoke_session(token)
        return web.json_response({"ok": True})

    # ------------------------------------------------------------------
    # Endpoint: users CRUD
    # ------------------------------------------------------------------

    async def _handle_list_users(self, request: web.Request) -> web.Response:
        if not await self._require_admin(request):
            return self._json_error("Unauthorized", 401)
        return web.json_response({"users": get_all_users()})

    async def _handle_create_user(self, request: web.Request) -> web.Response:
        actor = await self._require_admin(request)
        if not actor:
            return self._json_error("Unauthorized", 401)
        try:
            data = await request.json()
        except (json.JSONDecodeError, web.HTTPException):
            return self._json_error("Invalid JSON body", 400)

        username = data.get("username", "").strip()
        name = data.get("name", "").strip()
        password = data.get("password", "")
        role = data.get("role", "player")

        if not username or not password:
            return self._json_error("Username and password are required", 400)
        if role not in ("admin", "player"):
            return self._json_error("Role must be 'admin' or 'player'", 400)

        if create_user(username, name, password, role):
            return web.json_response(
                {"username": username, "name": name or username, "role": role},
                status=201,
            )
        return self._json_error("Username already exists", 409)

    async def _handle_update_user(self, request: web.Request) -> web.Response:
        actor = await self._require_admin(request)
        if not actor:
            return self._json_error("Unauthorized", 401)
        username = request.match_info["username"]
        try:
            data = await request.json()
        except (json.JSONDecodeError, web.HTTPException):
            return self._json_error("Invalid JSON body", 400)

        name = data.get("name")
        role = data.get("role")
        password = data.get("password")

        if role is not None and role not in ("admin", "player"):
            return self._json_error("Role must be 'admin' or 'player'", 400)

        if update_user(username, name=name, role=role, password=password):
            return web.json_response({"ok": True})
        return self._json_error("User not found", 404)

    async def _handle_delete_user(self, request: web.Request) -> web.Response:
        actor = await self._require_admin(request)
        if not actor:
            return self._json_error("Unauthorized", 401)
        username = request.match_info["username"]

        # Prevent self-deletion
        if username == actor:
            return self._json_error("Cannot delete your own account", 400)

        # Prevent deleting the last admin
        if is_admin(username) and admin_count() <= 1:
            return self._json_error("Cannot delete the last admin account", 400)

        if delete_user(username):
            return web.json_response({"ok": True})
        return self._json_error("User not found", 404)

    # ------------------------------------------------------------------
    # Room helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize_room_code(code: str) -> str:
        text = str(code or "").strip()
        if text.lower() == DEFAULT_ROOM_CODE:
            return DEFAULT_ROOM_CODE
        return text.upper()

    def _serialize_room(self, code: str, entry) -> dict:
        server = entry.server
        game = server.game_manager.game
        players = []
        if game:
            for p in game.players:
                players.append(
                    {
                        "id": p.id,
                        "name": p.name,
                        "hand_count": len(p.hand),
                        "is_online": p.id in server.player_connections,
                    }
                )
        return {
            "code": code,
            "state": game.state.value if game else None,
            "players": players,
            "player_count": len(players),
            "client_count": len(server.clients),
            "empty_since": entry.empty_since,
        }

    # ------------------------------------------------------------------
    # Endpoint: rooms
    # ------------------------------------------------------------------

    async def _handle_list_rooms(self, request: web.Request) -> web.Response:
        if not await self._require_admin(request):
            return self._json_error("Unauthorized", 401)
        rooms = [
            self._serialize_room(code, entry)
            for code, entry in self.hub._rooms.items()
        ]
        return web.json_response({"rooms": rooms})

    async def _handle_close_room(self, request: web.Request) -> web.Response:
        if not await self._require_admin(request):
            return self._json_error("Unauthorized", 401)
        code = self._normalize_room_code(request.match_info["code"])
        if code == DEFAULT_ROOM_CODE:
            return self._json_error("Cannot close the default room", 400)
        if code not in self.hub._rooms:
            return self._json_error("Room not found", 404)

        entry = self.hub._rooms[code]
        # Close all websockets so clients get a clean disconnect
        for ws in list(entry.server.clients):
            try:
                await ws.close()
            except Exception:
                pass
        # Remove the room entry; the hub's finally blocks will skip unregister
        del self.hub._rooms[code]
        logger.info("Admin force-closed room %s", code)
        return web.json_response({"ok": True})

    async def _handle_kick_player(self, request: web.Request) -> web.Response:
        if not await self._require_admin(request):
            return self._json_error("Unauthorized", 401)
        code = self._normalize_room_code(request.match_info["code"])
        player_id = request.match_info["player_id"]
        if code not in self.hub._rooms:
            return self._json_error("Room not found", 404)

        server = self.hub._rooms[code].server
        ws = server.player_connections.get(player_id)
        if ws:
            try:
                await ws.close()
            except Exception:
                pass
            logger.info("Admin kicked player %s from room %s", player_id, code)
            return web.json_response({"ok": True})
        return self._json_error("Player not found in room", 404)

    # ------------------------------------------------------------------
    # Endpoint: game state
    # ------------------------------------------------------------------

    async def _handle_game_state(self, request: web.Request) -> web.Response:
        if not await self._require_admin(request):
            return self._json_error("Unauthorized", 401)
        code = self._normalize_room_code(request.match_info["code"])
        if code not in self.hub._rooms:
            return self._json_error("Room not found", 404)

        game = self.hub._rooms[code].server.game_manager.game
        if not game:
            return web.json_response({"game_state": None})
        # Admin sees the full state with no card hiding
        return web.json_response({"game_state": game.model_dump()})

    # ------------------------------------------------------------------
    # Endpoint: stats
    # ------------------------------------------------------------------

    async def _handle_stats(self, request: web.Request) -> web.Response:
        if not await self._require_admin(request):
            return self._json_error("Unauthorized", 401)
        users = get_all_users()
        rooms = [
            self._serialize_room(code, entry)
            for code, entry in self.hub._rooms.items()
        ]
        active_games = sum(
            1 for r in rooms if r["state"] in ("playing", "special_phase")
        )
        online_players = sum(r["client_count"] for r in rooms)
        return web.json_response(
            {
                "total_users": len(users),
                "admin_count": admin_count(),
                "total_rooms": len(rooms),
                "active_games": active_games,
                "online_players": online_players,
            }
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()
        logger.info("Admin HTTP server started on %s:%s", self.host, self.port)
        # Run until cancelled
        await asyncio.Future()
