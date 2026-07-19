import asyncio
import json
from collections.abc import Collection

import websockets


class GameTestClient:
    def __init__(self, uri: str = "ws://localhost:8765", receive_timeout: float = 5.0):
        self.uri = uri
        self.receive_timeout = receive_timeout
        self.websocket = None
        self.player_id = None
        self.player_name = None
        self.messages = []

    async def connect(self, player_id: str, player_name: str):
        self.player_id = player_id
        self.player_name = player_name

        await self.open()
        print(f"[ok] {player_name} 已连接")

        await self.send_message({
            "type": "join_game",
            "player_id": player_id,
            "player_name": player_name
        })

        response = await self.receive_message({"join_success", "error"})
        print(f"  收到: {response}")

        return response

    async def send_message(self, message: dict):
        if self.websocket:
            await self.websocket.send(json.dumps(message))
            print(f"  发送: {message}")

    async def receive_message(self, expected_types: Collection[str] | None = None) -> dict:
        if not self.websocket:
            raise RuntimeError("WebSocket is not connected")

        loop = asyncio.get_running_loop()
        deadline = loop.time() + self.receive_timeout
        while True:
            remaining = deadline - loop.time()
            if remaining <= 0:
                raise TimeoutError(f"Timed out waiting for message types: {expected_types}")
            try:
                message = await asyncio.wait_for(self.websocket.recv(), timeout=remaining)
            except asyncio.TimeoutError as exc:
                raise TimeoutError(f"Timed out waiting for message types: {expected_types}") from exc

            data = json.loads(message)
            self.messages.append(data)
            if expected_types is None or data.get("type") in expected_types:
                return data

    async def play_card(self, card_id: str, usage_type: str, target_player_id: str = None):
        message = {
            "type": "play_card",
            "player_id": self.player_id,
            "card_id": card_id,
            "usage_type": usage_type
        }
        if target_player_id:
            message["target_player_id"] = target_player_id

        await self.send_message(message)
        response = await self.receive_message({"game_state", "error"})
        print(f"  收到: {response}")
        return response

    async def open(self):
        if self.websocket is None:
            self.websocket = await websockets.connect(self.uri)

    async def create_room(self):
        await self.open()
        await self.send_message({"type": "create_room"})
        return await self.receive_message({"room_created", "error"})

    async def join_room(self, room_code: str):
        await self.open()
        await self.send_message({"type": "join_room", "room_code": room_code})
        return await self.receive_message({"room_joined", "error"})

    async def get_game_state(self):
        await self.send_message({
            "type": "get_game_state",
            "player_id": self.player_id
        })
        return await self.receive_message({"game_state", "error"})

    async def start_game(self):
        await self.send_message({
            "type": "start_game",
            "player_id": self.player_id,
        })
        return await self.receive_message({"game_state", "error"})

    async def reset_game(self):
        await self.send_message({"type": "reset_game"})
        return await self.receive_message({"game_state", "error"})

    async def respond_honor_student(self, response: str):
        await self.send_message({
            "type": "honor_student_response",
            "player_id": self.player_id,
            "response": response
        })
        return await self.receive_message({"game_state", "error", "honor_student_phase"})

    async def close(self):
        if self.websocket:
            await self.websocket.close()
            print(f"[ok] {self.player_name} 已断开连接")

    async def listen(self):
        try:
            async for message in self.websocket:
                data = json.loads(message)
                self.messages.append(data)
                print(f"  {self.player_name} 收到: {data}")
        except websockets.exceptions.ConnectionClosed:
            print(f"[closed] {self.player_name} 连接已关闭")
