"""Hub-level session semantics: takeover, token rotation, and stable error codes.

Covers #126/#128: an authenticated re-login or reconnect displaces any live
session of the same account with an explicit notification, tokens rotate on
every success, and room actions require a hub session.
"""
import asyncio
import json
import os
import sys

import pytest
import pytest_asyncio
import websockets

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from websocket.hub import RoomHubWebSocketServer


@pytest_asyncio.fixture
async def hub_server():
    hub = RoomHubWebSocketServer(
        host="127.0.0.1",
        port=0,
        room_ttl_seconds=60,
    )
    async with websockets.serve(hub.handle_client, "127.0.0.1", 0) as server:
        port = server.sockets[0].getsockname()[1]
        yield hub, f"ws://127.0.0.1:{port}"


class RawClient:
    """Minimal WebSocket client mirroring the browser message ordering."""

    def __init__(self, uri: str):
        self.uri = uri
        self.ws = None

    async def open(self):
        self.ws = await websockets.connect(self.uri)

    async def send(self, **message):
        await self.ws.send(json.dumps(message))

    async def recv(self, timeout=2.0):
        return json.loads(await asyncio.wait_for(self.ws.recv(), timeout=timeout))

    async def recv_until(self, wanted_types, timeout=3.0):
        seen = []
        while True:
            message = await self.recv(timeout=timeout)
            seen.append(message)
            if message.get("type") in wanted_types:
                return seen, message

    async def expect_close(self, timeout=3.0):
        while True:
            try:
                await self.recv(timeout=timeout)
            except (asyncio.TimeoutError, websockets.ConnectionClosed):
                return

    async def close(self):
        if self.ws is not None:
            await self.ws.close()
            self.ws = None


async def _login(client: RawClient, username: str = "player2", password: str = "password2"):
    await client.open()
    await client.send(type="login", username=username, password=password)
    _, message = await client.recv_until({"login_success", "error"})
    return message


async def _start_three_player_game(uri: str):
    """Authenticated players create/join one room and start the game."""
    host = RawClient(uri)
    login = await _login(host, "player1", "password1")
    assert login["type"] == "login_success"
    await host.send(type="create_room")
    _, created = await host.recv_until({"room_created"})
    code = created["room_code"]
    joiners = []
    for index in (2, 3):
        joiner = RawClient(uri)
        login = await _login(joiner, f"player{index}", f"password{index}")
        assert login["type"] == "login_success"
        await joiner.send(type="join_room", room_code=code)
        _, joined = await joiner.recv_until({"room_joined"})
        assert joined["type"] == "room_joined"
        joiners.append(joiner)
    await host.send(type="start_game", player_id="player1")
    await host.recv_until({"game_state"})
    return host, joiners[0], joiners[1], code


@pytest.mark.e2e
async def test_relogin_from_new_socket_takes_over_and_closes_old(hub_server):
    hub, uri = hub_server
    first = RawClient(uri)
    await _login(first)

    second = RawClient(uri)
    message = await _login(second)
    assert message["type"] == "login_success"
    assert message["reconnect_token"]

    # The displaced socket is told why it was dropped, then closed by the server.
    _, notice = await first.recv_until({"error"})
    assert notice["code"] == "session_taken_over"
    await first.expect_close()

    # The old socket no longer counts as a connected client of any room.
    for entry in hub._rooms.values():
        assert first.ws not in entry.server.clients


@pytest.mark.e2e
async def test_same_socket_relogin_succeeds_idempotently(hub_server):
    _, uri = hub_server
    client = RawClient(uri)
    await client.open()
    first = await _login(client)
    assert first["type"] == "login_success"
    second = await _login(client)
    assert second["type"] == "login_success"
    # Tokens rotate on every success.
    assert second["reconnect_token"] != first["reconnect_token"]


@pytest.mark.e2e
async def test_reconnect_rotates_token_and_invalidates_previous(hub_server):
    _, uri = hub_server
    client = RawClient(uri)
    await client.open()
    login = await _login(client)
    token_one = login["reconnect_token"]

    await client.send(type="reconnect", username="player2", reconnect_token=token_one)
    _, reconnect = await client.recv_until({"reconnect_success"})
    token_two = reconnect["reconnect_token"]
    assert token_two and token_two != token_one

    # The rotated-out token can no longer authenticate a reconnect.
    challenger = RawClient(uri)
    await challenger.open()
    await challenger.send(type="reconnect", username="player2", reconnect_token=token_one)
    _, error = await challenger.recv_until({"error"})
    assert error["code"] == "invalid_reconnect_credentials"

    # The current token still works and rotates again.
    await challenger.send(type="reconnect", username="player2", reconnect_token=token_two)
    _, again = await challenger.recv_until({"reconnect_success", "error"})
    assert again["type"] == "reconnect_success"


@pytest.mark.e2e
async def test_reconnect_displaces_live_session_with_notice(hub_server):
    _, uri = hub_server
    original = RawClient(uri)
    login = await _login(original)

    replacement = RawClient(uri)
    await replacement.open()
    await replacement.send(type="reconnect", username="player2", reconnect_token=login["reconnect_token"])
    _, message = await replacement.recv_until({"reconnect_success"})
    assert message["reconnect_token"]

    _, notice = await original.recv_until({"error"})
    assert notice["code"] == "session_taken_over"
    await original.expect_close()


@pytest.mark.e2e
async def test_join_room_mid_game_non_member_returns_game_in_progress_code(hub_server):
    _, uri = hub_server
    host, second, third, code = await _start_three_player_game(uri)
    try:
        outsider = RawClient(uri)
        assert (await _login(outsider, "player4", "password4"))["type"] == "login_success"
        await outsider.send(type="join_room", room_code=code)
        _, message = await outsider.recv_until({"error"})
        assert message == {
            "type": "error",
            "code": "game_in_progress",
            "message": "游戏正在进行中，无法加入新玩家",
        }
    finally:
        for client in (host, second, third):
            await client.close()


@pytest.mark.e2e
async def test_member_can_rejoin_a_running_game(hub_server):
    _, uri = hub_server
    host, second, third, code = await _start_three_player_game(uri)
    try:
        # Player 2 drops and comes back with a fresh hub session.
        reconnector = RawClient(uri)
        login = await _login(reconnector, "player2", "password2")
        token = login["reconnect_token"]
        await reconnector.close()
        await asyncio.sleep(0.05)

        back = RawClient(uri)
        await back.open()
        await back.send(type="reconnect", username="player2", reconnect_token=token)
        _, success = await back.recv_until({"reconnect_success"})
        assert success["type"] == "reconnect_success"

        await back.send(type="join_room", room_code=code)
        _, joined = await back.recv_until({"room_joined", "error"})
        assert joined["type"] == "room_joined"

        await back.send(type="get_game_state", player_id="player2")
        _, state = await back.recv_until({"game_state"})
        assert {p["id"] for p in state["game_state"]["players"]} >= {"player1", "player2", "player3"}
    finally:
        for client in (host, third):
            await client.close()


@pytest.mark.e2e
async def test_reconnect_errors_carry_stable_codes(hub_server):
    _, uri = hub_server
    client = RawClient(uri)
    await client.open()

    await client.send(type="reconnect", username="player2", reconnect_token="wrong-token")
    _, invalid = await client.recv_until({"error"})
    assert invalid["code"] == "invalid_reconnect_credentials"

    # Password fallback authenticates without any prior session or game.
    await client.send(type="reconnect", username="player2", password="password2")
    _, success = await client.recv_until({"reconnect_success", "error"})
    assert success["type"] == "reconnect_success"
