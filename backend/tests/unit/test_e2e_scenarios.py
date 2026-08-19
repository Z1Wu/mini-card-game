import json

import pytest

from game.e2e_scenarios import SCENARIOS, initialize_e2e_scenario
from game.models import CardType, GameState
from game.state import GameManager
from websocket.server import GameWebSocketServer


class FakeWebSocket:
    def __init__(self):
        self.messages = []

    async def send(self, raw):
        self.messages.append(json.loads(raw))


def make_four_player_game():
    manager = GameManager()
    game = manager.create_game("e2e-fixtures")
    for index in range(4):
        assert manager.add_player(f"player{index + 1}", f"玩家{index + 1}")
    return game


def all_cards(game):
    cards = list(game.harmony_area)
    for player in game.players:
        cards.extend(player.hand)
        cards.extend(player.field_cards)
        cards.extend(player.doubt_cards)
    return cards


@pytest.mark.unit
@pytest.mark.parametrize("scenario_name", sorted(SCENARIOS))
def test_named_scenarios_are_valid_isolated_four_player_states(scenario_name):
    game = make_four_player_game()

    initialize_e2e_scenario(game, scenario_name)

    cards = all_cards(game)
    assert game.state == GameState.PLAYING
    assert game.player_count == 4
    assert game.current_player_index == 0
    assert game.required_harmony_value == 6
    assert all(player.current_hand_count == len(player.hand) == 3 for player in game.players)
    assert len({card.id for card in cards}) == len(cards)


@pytest.mark.unit
def test_scenario_fixtures_include_required_private_and_public_prerequisites():
    game = make_four_player_game()

    initialize_e2e_scenario(game, "honor-student")
    assert any(card.name == CardType.HONOR_STUDENT for card in game.players[0].hand)
    assert any(card.name == CardType.CRIMINAL for card in game.players[1].hand)
    assert any(card.name == CardType.ALIEN for card in game.players[2].hand)

    initialize_e2e_scenario(game, "accomplice")
    assert any(card.name == CardType.ACCOMPLICE for card in game.players[0].hand)
    assert len(game.players[1].doubt_cards) == 1


@pytest.mark.unit
@pytest.mark.asyncio
async def test_scenario_initialization_requires_enabled_runtime_and_room_host():
    disabled = GameWebSocketServer()
    host = FakeWebSocket()
    disabled.clients.add(host)
    for index in range(4):
        disabled.game_manager.add_player(f"player{index + 1}", f"玩家{index + 1}")
    disabled.player_connections["player1"] = host

    await disabled.handle_message(host, json.dumps({
        "type": "e2e_initialize_scenario",
        "scenario": "harmony",
    }))
    assert host.messages[-1]["message"] == "Unknown message type: e2e_initialize_scenario"

    enabled = GameWebSocketServer(enable_e2e_scenarios=True)
    host = FakeWebSocket()
    guest = FakeWebSocket()
    enabled.clients.update({host, guest})
    for index in range(4):
        enabled.game_manager.add_player(f"player{index + 1}", f"玩家{index + 1}")
    enabled.player_connections.update({"player1": host, "player2": guest})

    await enabled._handle_e2e_initialize_scenario(guest, {"scenario": "harmony"})
    assert guest.messages[-1]["message"] == "只有房主可以初始化 E2E 场景"

    await enabled._handle_e2e_initialize_scenario(host, {"scenario": "harmony"})
    assert any(message["type"] == "e2e_scenario_ready" for message in host.messages)
    host_state = next(message["game_state"] for message in reversed(host.messages) if message["type"] == "game_state")
    guest_state = next(message["game_state"] for message in reversed(guest.messages) if message["type"] == "game_state")
    assert len(host_state["players"][0]["hand"]) == 3
    assert guest_state["players"][0]["hand"] == []
    assert len(guest_state["players"][1]["hand"]) == 3
