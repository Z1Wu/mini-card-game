import asyncio
import json
import logging
import secrets
import string
import time
from collections import deque
from dataclasses import dataclass
from random import Random
from typing import Callable, Optional

import websockets

from .server import GameWebSocketServer


logger = logging.getLogger(__name__)
DEFAULT_ROOM_CODE = "default"
ROOM_CODE_ALPHABET = string.ascii_uppercase + string.digits


@dataclass
class RoomEntry:
    code: str
    server: GameWebSocketServer
    empty_since: Optional[float] = None


class RoomHubWebSocketServer:
    """Routes each WebSocket connection to an isolated game-room server.

    Connections begin in the backwards-compatible ``default`` room. New clients
    may send ``create_room`` or ``join_room`` before authenticating/joining a game.
    """

    def __init__(
        self,
        host: str = "localhost",
        port: int = 8765,
        room_ttl_seconds: float = 300,
        code_factory: Optional[Callable[[], str]] = None,
        origins: Optional[list[str]] = None,
        max_messages_per_second: int = 30,
        allow_legacy_join_game: bool = True,
        rng_seed: Optional[int] = None,
        rng_factory: Optional[Callable[[], Random]] = None,
    ):
        self.host = host
        self.port = port
        self.room_ttl_seconds = room_ttl_seconds
        self._code_factory = code_factory or self._generate_room_code
        self.origins = origins
        self.max_messages_per_second = max(1, max_messages_per_second)
        self.allow_legacy_join_game = allow_legacy_join_game
        if rng_factory is not None:
            self._rng_factory = rng_factory
        elif rng_seed is not None:
            self._rng_factory = lambda: Random(rng_seed)
        else:
            self._rng_factory = None
        self._rooms: dict[str, RoomEntry] = {}
        self._connection_rooms: dict[object, str] = {}
        self._room_lock = asyncio.Lock()
        # Hub-level username registry to prevent cross-room collisions.
        self._active_usernames: set[str] = set()
        self._rooms[DEFAULT_ROOM_CODE] = self._new_room(DEFAULT_ROOM_CODE)

    @property
    def room_codes(self) -> set[str]:
        return set(self._rooms)

    def _new_room(self, code: str) -> RoomEntry:
        # A new PRNG per room avoids state leaking between test rooms while keeping
        # ordinary production rooms random when no seed is supplied.
        rng = self._rng_factory() if self._rng_factory else None
        return RoomEntry(code=code, server=GameWebSocketServer(
            host=self.host,
            port=self.port,
            allow_legacy_join_game=self.allow_legacy_join_game,
            rng=rng,
            hub=self,
        ))

    def _generate_room_code(self) -> str:
        return "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(6))

    @staticmethod
    def _normalize_room_code(code: object) -> str:
        text = str(code or "").strip()
        if text.lower() == DEFAULT_ROOM_CODE:
            return DEFAULT_ROOM_CODE
        return text.upper()

    async def _send(self, websocket, payload: dict) -> None:
        await websocket.send(json.dumps(payload))

    def claim_username(self, username: str) -> bool:
        """Register *username* as active across the hub. Returns False if taken."""
        if username in self._active_usernames:
            return False
        self._active_usernames.add(username)
        return True

    def release_username(self, username: str) -> None:
        self._active_usernames.discard(username)

    async def _switch_room(self, websocket, room_code: str) -> None:
        """Move *websocket* to *room_code*. Caller must hold ``_room_lock``."""
        current_code = self._connection_rooms.get(websocket)
        if current_code == room_code:
            return

        if current_code and current_code in self._rooms:
            current_entry = self._rooms[current_code]
            await current_entry.server.unregister_client(websocket)
            if current_code != DEFAULT_ROOM_CODE and not current_entry.server.clients:
                current_entry.empty_since = time.monotonic()

        target_entry = self._rooms[room_code]
        target_entry.empty_since = None
        self._connection_rooms[websocket] = room_code
        await target_entry.server.register_client(websocket)

    async def _create_room(self, websocket) -> None:
        if not await self._ensure_room_switch_allowed(websocket):
            return
        async with self._room_lock:
            self.cleanup_expired_rooms()
            for _ in range(100):
                code = self._normalize_room_code(self._code_factory())
                if code and code != DEFAULT_ROOM_CODE and code not in self._rooms:
                    break
            else:
                await self._send(websocket, {
                    "type": "error",
                    "code": "room_code_exhausted",
                    "message": "Unable to allocate a unique room code",
                })
                return
            self._rooms[code] = self._new_room(code)
            await self._switch_room(websocket, code)
        logger.info("Created room %s", code)
        await self._send(websocket, {"type": "room_created", "room_code": code})

    async def _join_room(self, websocket, data: dict) -> None:
        if not await self._ensure_room_switch_allowed(websocket):
            return
        code = self._normalize_room_code(data.get("room_code"))
        async with self._room_lock:
            self.cleanup_expired_rooms()
            if not code or code not in self._rooms:
                await self._send(websocket, {
                    "type": "error",
                    "code": "room_not_found",
                    "message": "Room not found",
                })
                return

            await self._switch_room(websocket, code)
        logger.info("Connection joined room %s", code)
        await self._send(websocket, {"type": "room_joined", "room_code": code})

    async def _ensure_room_switch_allowed(self, websocket) -> bool:
        current_code = self._connection_rooms.get(websocket, DEFAULT_ROOM_CODE)
        current_entry = self._rooms.get(current_code)
        if current_entry and current_entry.server._get_player_id_by_websocket(websocket):
            await self._send(websocket, {
                "type": "error",
                "code": "room_switch_requires_disconnect",
                "message": "Disconnect before switching rooms",
            })
            return False
        return True

    async def _list_rooms(self, websocket) -> None:
        """Return non-default rooms with basic info (no auth required)."""
        self.cleanup_expired_rooms()
        rooms = []
        for code, entry in self._rooms.items():
            if code == DEFAULT_ROOM_CODE:
                continue
            server = entry.server
            game = server.game_manager.game
            state = game.state.value if game and game.state else None
            player_count = len(game.players) if game else 0
            player_names = [p.name for p in game.players] if game else []
            rooms.append({
                "code": code,
                "player_count": player_count,
                "state": state,
                "player_names": player_names,
            })
        await self._send(websocket, {"type": "room_list", "rooms": rooms})

    def cleanup_expired_rooms(self, now: Optional[float] = None) -> list[str]:
        current_time = time.monotonic() if now is None else now
        expired = []
        for code, entry in list(self._rooms.items()):
            if code == DEFAULT_ROOM_CODE or entry.server.clients or entry.empty_since is None:
                continue
            if current_time - entry.empty_since >= self.room_ttl_seconds:
                expired.append(code)
                del self._rooms[code]
                logger.info("Expired empty room %s", code)
        return expired

    async def handle_client(self, websocket) -> None:
        self._connection_rooms[websocket] = DEFAULT_ROOM_CODE
        recent_messages: deque[float] = deque()
        await self._rooms[DEFAULT_ROOM_CODE].server.register_client(websocket)
        try:
            async for message in websocket:
                now = time.monotonic()
                while recent_messages and now - recent_messages[0] >= 1:
                    recent_messages.popleft()
                if len(recent_messages) >= self.max_messages_per_second:
                    await self._send(websocket, {
                        "type": "error",
                        "code": "rate_limited",
                        "message": "Too many messages",
                    })
                    continue
                recent_messages.append(now)
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    await self._send(websocket, {
                        "type": "error",
                        "code": "invalid_json",
                        "message": "Invalid JSON message",
                    })
                    continue

                message_type = data.get("type") if isinstance(data, dict) else None
                if message_type == "create_room":
                    await self._create_room(websocket)
                elif message_type == "join_room":
                    await self._join_room(websocket, data)
                elif message_type == "list_rooms":
                    await self._list_rooms(websocket)
                else:
                    room_code = self._connection_rooms.get(websocket, DEFAULT_ROOM_CODE)
                    await self._rooms[room_code].server.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            async with self._room_lock:
                room_code = self._connection_rooms.pop(websocket, DEFAULT_ROOM_CODE)
                entry = self._rooms.get(room_code)
                if entry:
                    # Release any username claimed by this connection's player.
                    player_id = entry.server._get_player_id_by_websocket(websocket)
                    if player_id:
                        self.release_username(player_id)
                    await entry.server.unregister_client(websocket)
                    if room_code != DEFAULT_ROOM_CODE and not entry.server.clients:
                        entry.empty_since = time.monotonic()

    async def start(self) -> None:
        async with websockets.serve(
            self.handle_client,
            self.host,
            self.port,
            origins=self.origins,
        ):
            await asyncio.Future()
