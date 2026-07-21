import asyncio
import os
import sys

import pytest
import pytest_asyncio
import websockets

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from e2e.test_client import GameTestClient
from websocket.hub import DEFAULT_ROOM_CODE, RoomHubWebSocketServer


@pytest_asyncio.fixture
async def room_hub():
    codes = iter(["ROOMA1", "ROOMB2", "ROOMC3"])
    hub = RoomHubWebSocketServer(
        host="127.0.0.1",
        port=0,
        room_ttl_seconds=10,
        code_factory=lambda: next(codes),
    )
    async with websockets.serve(hub.handle_client, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]
        yield hub, f"ws://127.0.0.1:{port}"


@pytest.mark.e2e
async def test_default_room_remains_backwards_compatible(room_hub):
    _, uri = room_hub
    client = GameTestClient(uri)
    try:
        response = await client.connect("legacy-player", "旧客户端")
        assert response["type"] == "join_success"
        state = await client.get_game_state()
        assert state["game_state"]["player_count"] == 1
    finally:
        await client.close()


@pytest.mark.e2e
async def test_created_rooms_keep_game_state_isolated(room_hub):
    hub, uri = room_hub
    room_a = GameTestClient(uri)
    room_b = GameTestClient(uri)
    observer_a = GameTestClient(uri)
    try:
        created_a = await room_a.create_room()
        created_b = await room_b.create_room()
        assert created_a == {"type": "room_created", "room_code": "ROOMA1"}
        assert created_b == {"type": "room_created", "room_code": "ROOMB2"}

        assert (await room_a.connect("player-a", "玩家A"))["type"] == "join_success"
        assert (await room_b.connect("player-b", "玩家B"))["type"] == "join_success"

        joined = await observer_a.join_room("rooma1")
        assert joined == {"type": "room_joined", "room_code": "ROOMA1"}
        assert (await observer_a.connect("observer-a", "观察者A"))["type"] == "join_success"

        state_a = await room_a.get_game_state()
        state_b = await room_b.get_game_state()
        assert {player["id"] for player in state_a["game_state"]["players"]} == {"player-a", "observer-a"}
        assert {player["id"] for player in state_b["game_state"]["players"]} == {"player-b"}
        assert hub.room_codes == {DEFAULT_ROOM_CODE, "ROOMA1", "ROOMB2"}
    finally:
        await observer_a.close()
        await room_b.close()
        await room_a.close()


@pytest.mark.e2e
async def test_unknown_room_returns_stable_error_code(room_hub):
    _, uri = room_hub
    client = GameTestClient(uri)
    try:
        response = await client.join_room("missing")
        assert response["type"] == "error"
        assert response["code"] == "room_not_found"
    finally:
        await client.close()


@pytest.mark.e2e
async def test_authenticated_connection_must_disconnect_before_switching_rooms(room_hub):
    _, uri = room_hub
    client = GameTestClient(uri)
    try:
        assert (await client.connect("player", "玩家"))["type"] == "join_success"
        response = await client.create_room()
        assert response["type"] == "error"
        assert response["code"] == "room_switch_requires_disconnect"
    finally:
        await client.close()


@pytest.mark.e2e
async def test_player_can_reconnect_to_the_same_room(room_hub):
    _, uri = room_hub
    original = GameTestClient(uri)
    reconnecting = GameTestClient(uri)
    try:
        created = await original.create_room()
        code = created["room_code"]
        await original.send_message({"type": "login", "username": "player1", "password": "password1"})
        login = await original.receive_message({"login_success", "error"})
        assert login["type"] == "login_success"
        assert login["reconnect_token"]
        await original.close()
        await asyncio.sleep(0)

        assert (await reconnecting.join_room(code))["type"] == "room_joined"
        await reconnecting.send_message({
            "type": "reconnect",
            "username": "player1",
            "reconnect_token": login["reconnect_token"],
        })
        response = await reconnecting.receive_message({"reconnect_success", "error"})
        assert response["type"] == "reconnect_success"
        assert response["player_id"] == "player1"
    finally:
        await reconnecting.close()
        await original.close()


@pytest.mark.e2e
async def test_empty_rooms_expire_after_ttl(room_hub):
    hub, uri = room_hub
    client = GameTestClient(uri)
    created = await client.create_room()
    code = created["room_code"]
    await client.close()
    await asyncio.sleep(0)

    entry = hub._rooms[code]
    assert entry.empty_since is not None
    expired = hub.cleanup_expired_rooms(now=entry.empty_since + hub.room_ttl_seconds)
    assert expired == [code]
    assert code not in hub.room_codes
