import asyncio
import json
import websockets

class GameTestClient:
    def __init__(self, uri: str = "ws://localhost:8765"):
        self.uri = uri
        self.websocket = None
        self.player_id = None
        self.player_name = None
        self.messages = []

    async def connect(self, player_id: str, player_name: str):
        self.player_id = player_id
        self.player_name = player_name

        self.websocket = await websockets.connect(self.uri)
        print(f"✓ {player_name} 已连接")

        await self.send_message({
            "type": "join_game",
            "player_id": player_id,
            "player_name": player_name
        })

        response = await self.receive_message()
        print(f"  收到: {response}")

        return response

    async def send_message(self, message: dict):
        if self.websocket:
            await self.websocket.send(json.dumps(message))
            print(f"  发送: {message}")

    async def receive_message(self) -> dict:
        if self.websocket:
            message = await self.websocket.recv()
            data = json.loads(message)
            self.messages.append(data)
            return data
        return None

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
        response = await self.receive_message()
        print(f"  收到: {response}")
        return response

    async def get_game_state(self):
        await self.send_message({
            "type": "get_game_state",
            "player_id": self.player_id
        })
        return await self.receive_message()

    async def respond_honor_student(self, response: str):
        await self.send_message({
            "type": "honor_student_response",
            "player_id": self.player_id,
            "response": response
        })
        return await self.receive_message()

    async def close(self):
        if self.websocket:
            await self.websocket.close()
            print(f"✓ {self.player_name} 已断开连接")

    async def listen(self):
        try:
            async for message in self.websocket:
                data = json.loads(message)
                self.messages.append(data)
                print(f"  {self.player_name} 收到: {data}")
        except websockets.exceptions.ConnectionClosed:
            print(f"✗ {self.player_name} 连接已关闭")
