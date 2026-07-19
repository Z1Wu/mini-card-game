import asyncio
import json
import logging
import secrets
import string
import time
from dataclasses import dataclass
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
    ):
        self.host = host
        self.port = port
        self.room_ttl_seconds = room_ttl_seconds
        self._code_factory = code_factory or self._generate_room_code
        self._rooms: dict[str, RoomEntry] = {}
        self._connection_rooms: dict[object, str] = {}
        self._room_lock = asyncio.Lock()
        self._rooms[DEFAULT_ROOM_CODE] = self._new_room(DEFAULT_ROOM_CODE)

    @property
    def room_codes(self) -> set[str]:
        return set(self._rooms)

    def _new_room(self, code: str) -> RoomEntry:
        return RoomEntry(code=code, server=GameWebSocketServer(host=self.host, port=self.port))

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

    async def _switch_room(self, websocket, room_code: str) -> None:
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
        await self._rooms[DEFAULT_ROOM_CODE].server.register_client(websocket)
        try:
            async for message in websocket:
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
                else:
                    room_code = self._connection_rooms.get(websocket, DEFAULT_ROOM_CODE)
                    await self._rooms[room_code].server.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            room_code = self._connection_rooms.pop(websocket, DEFAULT_ROOM_CODE)
            entry = self._rooms.get(room_code)
            if entry:
                await entry.server.unregister_client(websocket)
                if room_code != DEFAULT_ROOM_CODE and not entry.server.clients:
                    entry.empty_since = time.monotonic()

    async def start(self) -> None:
        async with websockets.serve(self.handle_client, self.host, self.port):
            await asyncio.Future()
