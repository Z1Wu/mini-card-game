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


@pytest.mark.e2e
async def test_duplicate_player_id_is_rejected(server_uri):
    original = GameTestClient(server_uri)
    duplicate = GameTestClient(server_uri)
    try:
        assert (await original.connect("same-player", "原玩家"))["type"] == "join_success"
        response = await duplicate.connect("same-player", "重复玩家")
        assert response == {"type": "error", "message": "Failed to join game"}
    finally:
        await duplicate.close()
        await original.close()


@pytest.mark.e2e
async def test_new_player_cannot_join_active_game(server_uri):
    clients = await connect_players(server_uri, 3)
    late_joiner = GameTestClient(server_uri)
    try:
        started = await clients[0].start_game()
        assert started["game_state"]["state"] == GameState.PLAYING.value

        response = await late_joiner.connect("late-player", "迟到玩家")
        assert response == {"type": "error", "message": "Failed to join game"}
    finally:
        await late_joiner.close()
        await close_clients(clients)


@pytest.mark.e2e
async def test_playing_state_only_reveals_each_players_own_hand(server_uri):
    clients = await connect_players(server_uri, 3)
    try:
        host_state = (await clients[0].start_game())["game_state"]
        for player in host_state["players"]:
            expected_visible = 6 if player["id"] == clients[0].player_id else 0
            assert len(player["hand"]) == expected_visible
            assert player["current_hand_count"] == 6

        second_state = (await clients[1].get_game_state())["game_state"]
        for player in second_state["players"]:
            expected_visible = 6 if player["id"] == clients[1].player_id else 0
            assert len(player["hand"]) == expected_visible
    finally:
        await close_clients(clients)


@pytest.mark.e2e
async def test_socket_cannot_spoof_another_players_action(server_uri):
    clients = await connect_players(server_uri, 3)
    try:
        state = (await clients[0].start_game())["game_state"]
        current_id = state["players"][state["current_player_index"]]["id"]
        current_client = next(client for client in clients if client.player_id == current_id)
        attacker = next(client for client in clients if client.player_id != current_id)
        current_state = (await current_client.get_game_state())["game_state"]
        current_player = next(player for player in current_state["players"] if player["id"] == current_id)
        card_id = current_player["hand"][0]["id"]

        await attacker.send_message({
            "type": "play_card",
            "player_id": current_id,
            "card_id": card_id,
            "usage_type": "调和",
        })
        response = await attacker.receive_message({"error"})
        assert response["message"] == "玩家身份与当前连接不匹配"

        unchanged = (await current_client.get_game_state())["game_state"]
        assert unchanged["turn_count"] == state["turn_count"]
        current_after = next(player for player in unchanged["players"] if player["id"] == current_id)
        assert current_after["current_hand_count"] == 6
    finally:
        await close_clients(clients)


@pytest.mark.e2e
async def test_public_action_history_restores_without_revealing_facedown_card(server_uri):
    clients = await connect_players(server_uri, 3)
    try:
        state = (await clients[0].start_game())["game_state"]
        current_id = state["players"][state["current_player_index"]]["id"]
        current_client = next(client for client in clients if client.player_id == current_id)
        current_state = (await current_client.get_game_state())["game_state"]
        current_player = next(player for player in current_state["players"] if player["id"] == current_id)
        playable = next(card for card in current_player["hand"] if card["name"] != "犯人")

        played = await current_client.play_card(playable["id"], "调和")
        assert played["type"] == "game_state"
        restored = (await clients[0].get_game_state())["game_state"]
        assert restored["public_actions"] == [{
            "sequence": 1,
            "actor_id": current_id,
            "actor_name": current_player["name"],
            "usage_type": "调和",
            "target_player_id": None,
            "target_player_name": None,
            "card_name": None,
        }]
    finally:
        await close_clients(clients)


@pytest.mark.e2e
async def test_only_host_can_start_or_reset_game(server_uri):
    clients = await connect_players(server_uri, 3)
    try:
        start_error = await clients[1].start_game()
        assert start_error == {"type": "error", "message": "只有房主可以开始游戏"}

        started = await clients[0].start_game()
        assert started["game_state"]["state"] == GameState.PLAYING.value
        await clients[1].receive_message({"game_state"})

        reset_error = await clients[1].reset_game()
        assert reset_error == {"type": "error", "message": "只有房主可以重置游戏"}
        still_playing = await clients[0].get_game_state()
        assert still_playing["game_state"]["state"] == GameState.PLAYING.value
    finally:
        await close_clients(clients)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
