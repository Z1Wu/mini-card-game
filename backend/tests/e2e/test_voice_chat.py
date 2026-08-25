"""Hub-level voice chat gates (Issue #131).

Voice requires a hub session, a real (non-default) room, and only ever
reaches authenticated roommates in the same room — never the sender,
never other rooms, never the lobby.
"""
import asyncio
import base64
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


VOICE_DATA = base64.b64encode(b"fake-opus-audio").decode()


@pytest.mark.e2e
async def test_voice_chunk_reaches_roommates_but_never_the_sender(hub_server):
    hub, uri = hub_server
    host, p2, p3, code = await _start_three_player_game(uri)

    await host.send(type="voice_chunk", data=VOICE_DATA)

    _, relayed_second = await p2.recv_until({"voice_chunk"})
    assert relayed_second["type"] == "voice_chunk"
    assert relayed_second["from_player_id"] == "player1"
    assert relayed_second["data"] == VOICE_DATA
    _, relayed_third = await p3.recv_until({"voice_chunk"})
    assert relayed_third["data"] == VOICE_DATA
    # 发送者在短窗口内收不到任何回显。
    with pytest.raises(asyncio.TimeoutError):
        await host.recv(timeout=0.5)


@pytest.mark.e2e
async def test_voice_does_not_cross_rooms_and_waiting_rooms_reject_it(hub_server):
    hub, uri = hub_server
    host, p2, p3, code = await _start_three_player_game(uri)

    outsider = RawClient(uri)
    login = await _login(outsider, "player4", "password4")
    assert login["type"] == "login_success"
    await outsider.send(type="create_room")
    await outsider.recv_until({"room_created"})

    # 等待中的房间（未开局）拒绝语音。
    await outsider.send(type="voice_chunk", data=VOICE_DATA)
    _, denied = await outsider.recv_until({"error"})
    assert denied["code"] == "voice_unavailable"

    # 房 A 内的语音不会泄漏到房 B。
    await host.send(type="voice_chunk", data=VOICE_DATA)
    await p2.recv_until({"voice_chunk"})
    await p3.recv_until({"voice_chunk"})
    with pytest.raises(asyncio.TimeoutError):
        await outsider.recv(timeout=0.5)


@pytest.mark.e2e
async def test_authenticated_user_in_default_lobby_cannot_use_voice(hub_server):
    hub, uri = hub_server
    client = RawClient(uri)
    login = await _login(client, "player5", "password5")
    assert login["type"] == "login_success"

    await client.send(type="voice_chunk", data=VOICE_DATA)

    _, message = await client.recv_until({"error"})
    assert message["code"] == "voice_unavailable"


@pytest.mark.e2e
async def test_voice_requires_hub_login(hub_server):
    hub, uri = hub_server
    client = RawClient(uri)
    await client.open()

    await client.send(type="voice_chunk", data=VOICE_DATA)

    _, message = await client.recv_until({"error"})
    assert message["code"] == "authentication_required"
