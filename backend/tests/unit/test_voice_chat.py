"""Push-to-talk relay rules (Issue #131).

Covers the room-server half of voice chat: socket-bound identity, started-game
gate, chunk validation, per-player rate limiting, and relay targeting that
never echoes audio back to the sender.
"""
import base64
import json
import time

import pytest

from game.models import GameState
from websocket.server import GameWebSocketServer


class FakeWebSocket:
    def __init__(self):
        self.messages = []

    async def send(self, raw):
        self.messages.append(json.loads(raw))


def make_playing_server(player_count: int = 3):
    """A server whose game is PLAYING with fake sockets bound to each player."""
    server = GameWebSocketServer()
    manager = server.game_manager
    for index in range(player_count):
        assert manager.add_player(f"p{index + 1}", f"玩家{index + 1}")
    manager.game.state = GameState.PLAYING
    sockets = {}
    for index in range(player_count):
        player_id = f"p{index + 1}"
        sockets[player_id] = FakeWebSocket()
        server.player_connections[player_id] = sockets[player_id]
    return server, sockets


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def error_codes(socket: FakeWebSocket) -> list:
    return [m.get("code") for m in socket.messages if m.get("type") == "error"]


def received_voice(socket: FakeWebSocket) -> list:
    return [m for m in socket.messages if m.get("type") == "voice_chunk"]


@pytest.mark.unit
async def test_chunk_is_relayed_to_other_players_never_to_sender():
    server, sockets = make_playing_server()

    await server.handle_message(sockets["p1"], json.dumps({
        "type": "voice_chunk",
        "data": b64(b"fake-opus-audio"),
    }))

    assert len(received_voice(sockets["p2"])) == 1
    relayed = received_voice(sockets["p3"])[0]
    assert relayed["from_player_id"] == "p1"
    assert relayed["data"] == b64(b"fake-opus-audio")
    assert isinstance(relayed["seq"], int)
    # 不回发发送者，也不夹带错误。
    assert sockets["p1"].messages == []


@pytest.mark.unit
async def test_unauthenticated_socket_cannot_send_or_receive_voice():
    server, sockets = make_playing_server()
    outsider = FakeWebSocket()

    await server.handle_message(outsider, json.dumps({
        "type": "voice_chunk",
        "data": b64(b"fake-opus-audio"),
    }))

    assert outsider.messages[0]["type"] == "error"
    assert not received_voice(sockets["p2"])
    assert not received_voice(sockets["p3"])


@pytest.mark.unit
async def test_spoofed_player_id_in_payload_is_rejected():
    server, sockets = make_playing_server()

    await server.handle_message(sockets["p1"], json.dumps({
        "type": "voice_chunk",
        "player_id": "p2",
        "data": b64(b"fake-opus-audio"),
    }))

    assert sockets["p1"].messages[0]["message"] == "玩家身份与当前连接不匹配"
    assert not received_voice(sockets["p2"])
    assert not received_voice(sockets["p3"])


@pytest.mark.unit
async def test_voice_is_unavailable_while_the_room_is_waiting():
    server = GameWebSocketServer()
    assert server.game_manager.add_player("p1", "玩家1")
    sender = FakeWebSocket()
    server.player_connections["p1"] = sender

    await server.handle_message(sender, json.dumps({
        "type": "voice_chunk",
        "data": b64(b"fake-opus-audio"),
    }))

    assert error_codes(sender) == ["voice_unavailable"]


@pytest.mark.unit
async def test_invalid_base64_payload_is_rejected_without_relay():
    server, sockets = make_playing_server()

    await server.handle_message(sockets["p1"], json.dumps({
        "type": "voice_chunk",
        "data": "!!!not-base64!!!",
    }))
    await server.handle_message(sockets["p1"], json.dumps({
        "type": "voice_chunk",
        "data": 12345,
    }))

    assert error_codes(sockets["p1"]) == ["invalid_voice_chunk", "invalid_voice_chunk"]
    assert not received_voice(sockets["p2"])


@pytest.mark.unit
async def test_oversized_chunk_is_rejected_without_relay():
    server, sockets = make_playing_server()
    server.max_voice_chunk_bytes = 8

    await server.handle_message(sockets["p1"], json.dumps({
        "type": "voice_chunk",
        "data": b64(b"0123456789"),
    }))

    assert error_codes(sockets["p1"]) == ["voice_too_large"]
    assert not received_voice(sockets["p2"])


@pytest.mark.unit
async def test_flooded_chunks_are_rate_limited_for_the_sender_only():
    server, sockets = make_playing_server()
    payload = json.dumps({"type": "voice_chunk", "data": b64(b"a")})

    await server.handle_message(sockets["p1"], payload)
    # 第二条紧随其后：把记账时间拨回「刚发过」，避免真实计时抖动。
    server._last_voice_at["p1"] = time.monotonic()
    await server.handle_message(sockets["p1"], payload)

    assert error_codes(sockets["p1"]) == ["voice_rate_limited"]
    assert len(received_voice(sockets["p2"])) == 1
    # 其他玩家不受该玩家限流影响。
    await server.handle_message(sockets["p2"], payload)
    assert len(received_voice(sockets["p1"])) == 1
    assert len(received_voice(sockets["p3"])) == 2


@pytest.mark.unit
async def test_disconnecting_player_stops_counting_toward_voice_limits():
    server, sockets = make_playing_server()
    await server.handle_message(sockets["p1"], json.dumps({
        "type": "voice_chunk",
        "data": b64(b"a"),
    }))
    assert "p1" in server._last_voice_at

    await server.unregister_client(sockets["p1"])

    assert "p1" not in server._last_voice_at
