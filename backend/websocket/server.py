import asyncio
import json
import websockets
from typing import Set, Dict
from game.state import GameManager
from game.rules import GameRules
from game.victory import VictoryChecker
from game.models import GameState, CardUsageType

class GameWebSocketServer:
    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.player_connections: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.game_manager = GameManager()
        self.game_manager.create_game("default_game")
        self.game_rules = GameRules(self.game_manager)
        self.honor_student_responses: Dict[str, str] = {}

    async def register_client(self, websocket: websockets.WebSocketServerProtocol):
        self.clients.add(websocket)
        print(f"Client connected. Total clients: {len(self.clients)}")

    async def unregister_client(self, websocket: websockets.WebSocketServerProtocol):
        self.clients.discard(websocket)
        player_id = self._get_player_id_by_websocket(websocket)
        if player_id:
            del self.player_connections[player_id]
            print(f"Player {player_id} disconnected. Total clients: {len(self.clients)}")

    def _get_player_id_by_websocket(self, websocket: websockets.WebSocketServerProtocol) -> str:
        for player_id, ws in self.player_connections.items():
            if ws == websocket:
                return player_id
        return None

    async def broadcast(self, message: dict):
        if self.clients:
            await asyncio.gather(
                *[client.send(json.dumps(message)) for client in self.clients],
                return_exceptions=True
            )

    async def send_to_client(self, websocket: websockets.WebSocketServerProtocol, message: dict):
        try:
            await websocket.send(json.dumps(message))
        except Exception as e:
            print(f"Error sending message to client: {e}")

    async def handle_message(self, websocket: websockets.WebSocketServerProtocol, message: str):
        try:
            data = json.loads(message)
            message_type = data.get("type")

            if message_type == "join_game":
                await self._handle_join_game(websocket, data)
            elif message_type == "start_game":
                await self._handle_start_game(data)
            elif message_type == "play_card":
                await self._handle_play_card(data)
            elif message_type == "get_game_state":
                await self._handle_get_game_state(data)
            elif message_type == "honor_student_response":
                await self._handle_honor_student_response(data)
            else:
                await self.send_to_client(websocket, {
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                })
        except json.JSONDecodeError:
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Invalid JSON format"
            })
        except Exception as e:
            print(f"Error handling message: {e}")
            await self.send_to_client(websocket, {
                "type": "error",
                "message": str(e)
            })

    async def _handle_join_game(self, websocket: websockets.WebSocketServerProtocol, data: dict):
        player_id = data.get("player_id")
        player_name = data.get("player_name")

        if not player_id or not player_name:
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Missing player_id or player_name"
            })
            return

        success = self.game_manager.add_player(player_id, player_name)
        if success:
            self.player_connections[player_id] = websocket
            await self.send_to_client(websocket, {
                "type": "join_success",
                "player_id": player_id,
                "player_name": player_name
            })
            await self._broadcast_player_list()
        else:
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Failed to join game"
            })

    async def _handle_start_game(self, data: dict):
        player_id = data.get("player_id")
        if not self.game_manager.game:
            await self.broadcast({
                "type": "error",
                "message": "No game exists"
            })
            return

        if len(self.game_manager.game.players) < 3:
            await self.broadcast({
                "type": "error",
                "message": "Need at least 3 players to start"
            })
            return

        success = self.game_manager.start_game()
        if success:
            await self._broadcast_game_state()
        else:
            await self.broadcast({
                "type": "error",
                "message": "Failed to start game"
            })

    async def _handle_play_card(self, data: dict):
        player_id = data.get("player_id")
        card_id = data.get("card_id")
        usage_type = data.get("usage_type")
        target_player_id = data.get("target_player_id")

        if not player_id or not card_id or not usage_type:
            await self.broadcast({
                "type": "error",
                "message": "Missing required fields"
            })
            return

        success = self.game_rules.play_card(player_id, card_id, usage_type, target_player_id)
        if success:
            await self._broadcast_game_state()
            
            victory_checker = VictoryChecker(self.game_manager.game)
            winner = victory_checker.check_victory()
            if winner:
                await self._broadcast_game_over(winner)
        else:
            await self.broadcast({
                "type": "error",
                "message": "Failed to play card"
            })

    async def _handle_get_game_state(self, data: dict):
        player_id = data.get("player_id")
        websocket = self.player_connections.get(player_id)
        if websocket:
            await self.send_to_client(websocket, {
                "type": "game_state",
                "game_state": self.game_manager.game.to_dict() if self.game_manager.game else None
            })

    async def _handle_honor_student_response(self, data: dict):
        player_id = data.get("player_id")
        response = data.get("response")
        
        if player_id and response:
            self.honor_student_responses[player_id] = response
            
            if len(self.honor_student_responses) >= 2:
                await self._process_honor_student_responses()

    async def _process_honor_student_responses(self):
        pass

    async def _broadcast_player_list(self):
        if self.game_manager.game:
            players = [
                {
                    "id": player.id,
                    "name": player.name,
                    "hand_count": len(player.hand)
                }
                for player in self.game_manager.game.players
            ]
            await self.broadcast({
                "type": "player_list",
                "players": players
            })

    async def _broadcast_game_state(self):
        if self.game_manager.game:
            await self.broadcast({
                "type": "game_state",
                "game_state": self.game_manager.game.to_dict()
            })

    async def _broadcast_game_over(self, winner_id: str):
        await self.broadcast({
            "type": "game_over",
            "winner_id": winner_id
        })

    async def handle_client(self, websocket: websockets.WebSocketServerProtocol):
        await self.register_client(websocket)
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed by client")
        except Exception as e:
            print(f"Error handling client: {e}")
        finally:
            await self.unregister_client(websocket)

    async def start(self):
        print(f"Starting WebSocket server on {self.host}:{self.port}")
        async with websockets.serve(self.handle_client, self.host, self.port):
            await asyncio.Future()
