import json
import pytest
from game.e2e_scenarios import initialize_e2e_scenario
from game.models import CardType
from websocket.server import GameWebSocketServer

class Socket:
    def __init__(self): self.messages = []
    async def send(self, raw): self.messages.append(json.loads(raw))

@pytest.mark.unit
async def test_discipline_waits_for_authenticated_confirmation_once():
    server = GameWebSocketServer()
    for i in range(4): server.game_manager.add_player(f"player{i+1}", f"玩家{i+1}")
    game = server.game_manager.game
    initialize_e2e_scenario(game, "discipline-committee")
    sockets = {p.id: Socket() for p in game.players}
    server.player_connections.update(sockets)
    card = next(c for c in game.players[0].hand if c.name == CardType.DISCIPLINE_COMMITTEE)
    await server._handle_play_card(sockets["player1"], {"card_id": card.id, "usage_type": "特技", "target_player_id": "player2"})
    assert game.current_player_index == 0
    assert server.pending_view_hand
    assert any(m["type"] == "view_hand" for m in sockets["player1"].messages)
    assert not any(m["type"] == "view_hand" for m in sockets["player2"].messages)
    await server._handle_view_hand_confirm(sockets["player2"], {"player_id": "player1"})
    assert game.current_player_index == 0
    await server._handle_play_card(sockets["player1"], {"card_id": game.players[0].hand[0].id, "usage_type": "调和"})
    assert game.current_player_index == 0
    await server._resume_pending_interaction("player1", sockets["player1"])
    assert sockets["player1"].messages[-1]["type"] == "view_hand"
    await server._handle_view_hand_confirm(sockets["player1"], {})
    assert game.current_player_index == 1
    await server._handle_view_hand_confirm(sockets["player1"], {})
    assert game.current_player_index == 1
