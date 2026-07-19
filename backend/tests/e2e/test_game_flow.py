import os
import sys

import pytest
import pytest_asyncio
import websockets

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from e2e.test_client import GameTestClient
from game.models import GameState
from websocket.server import GameWebSocketServer


@pytest_asyncio.fixture
async def server_uri():
    """Run every E2E test against a fresh server to prevent state leaking between tests."""
    game_server = GameWebSocketServer(host="127.0.0.1", port=0)
    async with websockets.serve(game_server.handle_client, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]
        yield f"ws://127.0.0.1:{port}"


async def connect_players(server_uri: str, count: int) -> list[GameTestClient]:
    clients = []
    for index in range(count):
        client = GameTestClient(server_uri)
        response = await client.connect(f"player_{index + 1}", f"玩家{index + 1}")
        assert response["type"] == "join_success"
        clients.append(client)
    return clients


async def close_clients(clients: list[GameTestClient]):
    for client in clients:
        await client.close()


@pytest.mark.e2e
async def test_basic_game_start_and_state(server_uri):
    clients = await connect_players(server_uri, 3)
    try:
        response = await clients[0].start_game()
        assert response["type"] == "game_state"
        state = response["game_state"]
        assert state["state"] == GameState.PLAYING.value
        assert state["player_count"] == 3
        assert all(player["current_hand_count"] == 6 for player in state["players"])

        refreshed = await clients[1].get_game_state()
        assert refreshed["game_state"]["state"] == GameState.PLAYING.value
    finally:
        await close_clients(clients)


@pytest.mark.e2e
async def test_reset_game_preserves_players_and_clears_cards(server_uri):
    clients = await connect_players(server_uri, 3)
    try:
        started = await clients[0].start_game()
        assert started["game_state"]["state"] == GameState.PLAYING.value

        reset = await clients[0].reset_game()
        state = reset["game_state"]
        assert state["state"] == GameState.WAITING.value
        assert state["player_count"] == 3
        assert all(player["current_hand_count"] == 0 for player in state["players"])
    finally:
        await close_clients(clients)


@pytest.mark.e2e
async def test_maximum_five_players(server_uri):
    clients = await connect_players(server_uri, 5)
    overflow = GameTestClient(server_uri)
    try:
        response = await overflow.connect("player_6", "玩家6")
        assert response == {"type": "error", "message": "Failed to join game"}

        state = await clients[0].get_game_state()
        assert state["game_state"]["player_count"] == 5
    finally:
        await overflow.close()
        await close_clients(clients)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
