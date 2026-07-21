import json

import pytest

from game.cards import CARD_DATABASE
from game.models import Card, CardType, CardUsageType, GameState
from game.rules import GameRules
from game.state import GameManager
from websocket.server import GameWebSocketServer


def make_card(card_type: CardType, suffix: str) -> Card:
    data = CARD_DATABASE[card_type]
    return Card(
        id=f"{card_type.value}_{suffix}",
        name=card_type,
        description=data["description"],
        harmony_value=data["harmony_value"],
        victory_priority=data["victory_priority"],
        victory_condition=data["victory_condition"],
    )


def make_playing_manager(player_count: int = 4) -> GameManager:
    manager = GameManager()
    manager.create_game("special-rules")
    for index in range(player_count):
        manager.add_player(f"p{index + 1}", f"玩家{index + 1}")
    manager.game.state = GameState.PLAYING
    manager.game.player_count = player_count
    for index, player in enumerate(manager.game.players):
        player.hand = [
            make_card(CardType.HOME_CLUB, f"filler-{index}-a"),
            make_card(CardType.HOME_CLUB, f"filler-{index}-b"),
        ]
        player.current_hand_count = 2
    return manager


@pytest.mark.unit
def test_accomplice_moves_the_selected_doubt_card_atomically():
    manager = make_playing_manager()
    actor, source, target, _ = manager.game.players
    accomplice = make_card(CardType.ACCOMPLICE, "skill")
    actor.hand.append(accomplice)
    actor.current_hand_count = len(actor.hand)
    doubt_card = make_card(CardType.LIBRARY_COMMITTEE, "doubt")
    doubt_card.location = "doubt"
    doubt_card.target_player_id = source.id
    source.doubt_cards.append(doubt_card)

    success = GameRules(manager).play_card(
        actor.id,
        accomplice.id,
        CardUsageType.SKILL,
        target_player_id=target.id,
        target_card_id=doubt_card.id,
        source_player_id=source.id,
    )

    assert success is True
    assert doubt_card not in source.doubt_cards
    assert target.doubt_cards == [doubt_card]
    assert doubt_card.target_player_id == target.id
    assert accomplice in actor.field_cards


@pytest.mark.unit
def test_invalid_accomplice_destination_does_not_consume_the_card():
    manager = make_playing_manager()
    actor, source, _, _ = manager.game.players
    accomplice = make_card(CardType.ACCOMPLICE, "skill")
    actor.hand.append(accomplice)
    actor.current_hand_count = len(actor.hand)
    doubt_card = make_card(CardType.LIBRARY_COMMITTEE, "doubt")
    source.doubt_cards.append(doubt_card)

    success = GameRules(manager).play_card(
        actor.id,
        accomplice.id,
        CardUsageType.SKILL,
        target_player_id=actor.id,
        target_card_id=doubt_card.id,
        source_player_id=source.id,
    )

    assert success is False
    assert accomplice in actor.hand
    assert doubt_card in source.doubt_cards
    assert not actor.field_cards


class FakeWebSocket:
    def __init__(self):
        self.messages: list[dict] = []

    async def send(self, message: str) -> None:
        self.messages.append(json.loads(message))


@pytest.mark.unit
@pytest.mark.asyncio
async def test_infected_offers_one_optional_next_turn_take():
    server = GameWebSocketServer()
    manager = make_playing_manager(3)
    server.game_manager = manager
    server.game_rules = GameRules(manager)
    current = manager.game.players[0]
    infected = make_card(CardType.INFECTED, "active")
    infected.location = "field"
    infected.is_face_up = True
    current.field_cards.append(infected)
    harmony_card = make_card(CardType.LIBRARY_COMMITTEE, "harmony")
    harmony_card.location = "harmony"
    manager.game.harmony_area.append(harmony_card)

    websocket = FakeWebSocket()
    server.clients.add(websocket)
    server.player_connections[current.id] = websocket

    await server._broadcast_game_state()
    assert manager.game.state == GameState.SPECIAL_PHASE
    assert server.pending_infected == {"player_id": current.id, "card_id": infected.id}
    prompt = next(message for message in websocket.messages if message["type"] == "infected_choice_required")
    assert prompt["harmony_cards"] == [{"id": harmony_card.id}]

    await server._handle_infected_choice(websocket, {
        "type": "infected_choice",
        "player_id": current.id,
        "take_card": True,
        "harmony_card_id": harmony_card.id,
    })

    assert manager.game.state == GameState.PLAYING
    assert server.pending_infected is None
    assert harmony_card in current.hand
    assert harmony_card not in manager.game.harmony_area
    assert infected.id in server.resolved_infected_card_ids

    before = len([m for m in websocket.messages if m["type"] == "infected_choice_required"])
    await server._broadcast_game_state()
    after = len([m for m in websocket.messages if m["type"] == "infected_choice_required"])
    assert after == before
