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
        assert (await room_a.login("player1", "password1"))["type"] == "login_success"
        assert (await room_b.login("player2", "password2"))["type"] == "login_success"

        created_a = await room_a.create_room()
        created_b = await room_b.create_room()
        assert created_a == {"type": "room_created", "room_code": "ROOMA1"}
        assert created_b == {"type": "room_created", "room_code": "ROOMB2"}

        assert (await observer_a.login("player3", "password3"))["type"] == "login_success"
        joined = await observer_a.join_room("rooma1")
        assert joined == {"type": "room_joined", "room_code": "ROOMA1"}

        state_a = await room_a.get_game_state()
        state_b = await room_b.get_game_state()
        assert {player["id"] for player in state_a["game_state"]["players"]} == {"player1", "player3"}
        assert {player["id"] for player in state_b["game_state"]["players"]} == {"player2"}
        assert hub.room_codes == {DEFAULT_ROOM_CODE, "ROOMA1", "ROOMB2"}
    finally:
        await observer_a.close()
        await room_b.close()
        await room_a.close()


@pytest.mark.e2e
async def test_room_actions_require_hub_authentication(room_hub):
    _, uri = room_hub
    client = GameTestClient(uri)
    try:
        await client.open()

        await client.send_message({"type": "create_room"})
        response = await client.receive_message({"error"})
        assert response["code"] == "authentication_required"

        await client.send_message({"type": "join_room", "room_code": "ROOMA1"})
        response = await client.receive_message({"error"})
        assert response["code"] == "authentication_required"

        await client.send_message({"type": "list_rooms"})
        response = await client.receive_message({"error"})
        assert response["code"] == "authentication_required"
    finally:
        await client.close()


@pytest.mark.e2e
async def test_unknown_room_returns_stable_error_code(room_hub):
    _, uri = room_hub
    client = GameTestClient(uri)
    try:
        assert (await client.login("player1", "password1"))["type"] == "login_success"
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
        assert (await client.login("player1", "password1"))["type"] == "login_success"
        assert (await client.create_room())["type"] == "room_created"
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
        assert (await original.login("player1", "password1"))["type"] == "login_success"
        created = await original.create_room()
        code = created["room_code"]
        await original.close()
        await asyncio.sleep(0)

        assert (await reconnecting.reconnect("player1", reconnect_token=None, password="password1"))["type"] == "reconnect_success"
        joined = await reconnecting.join_room(code)
        assert joined == {"type": "room_joined", "room_code": code}
        state = await reconnecting.get_game_state()
        assert [player["id"] for player in state["game_state"]["players"]] == ["player1"]
    finally:
        await reconnecting.close()
        await original.close()


@pytest.mark.e2e
async def test_empty_rooms_expire_after_ttl(room_hub):
    hub, uri = room_hub
    client = GameTestClient(uri)
    assert (await client.login("player1", "password1"))["type"] == "login_success"
    created = await client.create_room()
    code = created["room_code"]
    await client.close()

    entry = hub._rooms[code]
    # The client's close call can complete before the server task has run its
    # disconnect cleanup, so wait for the server-side state transition.
    for _ in range(20):
        if entry.empty_since is not None:
            break
        await asyncio.sleep(0.01)
    assert entry.empty_since is not None
    expired = hub.cleanup_expired_rooms(now=entry.empty_since + hub.room_ttl_seconds)
    assert expired == [code]
    assert code not in hub.room_codes


@pytest.mark.e2e
def test_seeded_rooms_receive_reproducible_fresh_deals():
    def deal(seed):
        hub = RoomHubWebSocketServer(rng_seed=seed)
        room = hub._new_room("TEST01").server.game_manager
        room.create_game("seeded")
        for index in range(3):
            assert room.add_player(f"player-{index}", f"玩家{index}")
        assert room.start_game()
        return (
            [[card.id for card in player.hand] for player in room.game.players],
            room.game.current_player_index,
        )

    assert deal(75) == deal(75)
    assert deal(75) != deal(76)
    assert RoomHubWebSocketServer()._rooms[DEFAULT_ROOM_CODE].server.game_manager is not None


@pytest.mark.e2e
async def test_second_login_displaces_the_first_connection(room_hub):
    """One active session per account: a newer login closes the older socket."""
    _, uri = room_hub
    first = GameTestClient(uri)
    second = GameTestClient(uri)
    try:
        assert (await first.login("player1", "password1"))["type"] == "login_success"
        assert (await second.login("player1", "password1"))["type"] == "login_success"

        notice = await first.receive_message({"error"})
        assert notice["code"] == "session_taken_over"
        # The displaced socket is closed by the server shortly after.
        closed = False
        try:
            await asyncio.wait_for(first.websocket.recv(), timeout=2)
        except websockets.exceptions.ConnectionClosed:
            closed = True
        except asyncio.TimeoutError:
            closed = False
        assert closed
    finally:
        await second.close()
        await first.close()


@pytest.mark.e2e
async def test_username_released_after_disconnect_allows_relogin(room_hub):
    """After disconnect, the same username should be usable again."""
    _, uri = room_hub
    original = GameTestClient(uri)
    replacement = GameTestClient(uri)
    try:
        assert (await original.login("player1", "password1"))["type"] == "login_success"
        await original.close()
        await asyncio.sleep(0.05)

        assert (await replacement.login("player1", "password1"))["type"] == "login_success"
        assert (await replacement.create_room())["type"] == "room_created"
    finally:
        await replacement.close()
        await original.close()


@pytest.mark.e2e
async def test_list_rooms_returns_active_rooms(room_hub):
    """Authenticated list_rooms should return non-default rooms with player info."""
    _, uri = room_hub
    creator = GameTestClient(uri)
    lister = GameTestClient(uri)
    try:
        assert (await creator.login("player1", "password1"))["type"] == "login_success"
        created = await creator.create_room()
        code = created["room_code"]

        # List rooms from a different authenticated connection.
        assert (await lister.login("player2", "password2"))["type"] == "login_success"
        await lister.send_message({"type": "list_rooms"})
        response = await lister.receive_message({"room_list", "error"})
        assert response["type"] == "room_list"
        rooms = response["rooms"]
        codes = [r["code"] for r in rooms]
        assert code in codes
        # The internal holding room should not appear.
        assert DEFAULT_ROOM_CODE not in codes
        room_entry = next(r for r in rooms if r["code"] == code)
        assert room_entry["player_count"] == 1
        assert "玩家1" in room_entry["player_names"]
    finally:
        await lister.close()
        await creator.close()
