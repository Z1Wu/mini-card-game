"""Server-owned deterministic states for browser E2E coverage.

These fixtures are intentionally unavailable unless the websocket server is
started with its explicit E2E flag.  The browser may select a fixture by name,
but it cannot submit cards or arbitrary game state.
"""

from dataclasses import dataclass, field
from typing import Dict, List

from .cards import create_card_deck
from .models import Card, CardType, Game, GameState


@dataclass(frozen=True)
class ScenarioSpec:
    actor: int = 0
    hands: Dict[int, List[CardType]] = field(default_factory=dict)
    harmony: List[CardType] = field(default_factory=list)
    fields: Dict[int, List[CardType]] = field(default_factory=dict)
    doubts: Dict[int, List[CardType]] = field(default_factory=dict)


SCENARIOS: Dict[str, ScenarioSpec] = {
    "harmony": ScenarioSpec(hands={0: [CardType.LIBRARY_COMMITTEE]}),
    "doubt": ScenarioSpec(hands={0: [CardType.LIBRARY_COMMITTEE]}),
    "library-committee": ScenarioSpec(
        hands={0: [CardType.LIBRARY_COMMITTEE]},
        harmony=[CardType.STUDENT_COUNCIL_PRESIDENT],
    ),
    "home-club": ScenarioSpec(
        hands={0: [CardType.HOME_CLUB, CardType.HEALTH_COMMITTEE]},
        harmony=[CardType.STUDENT_COUNCIL_PRESIDENT],
    ),
    "health-committee": ScenarioSpec(
        hands={0: [CardType.HEALTH_COMMITTEE]},
        fields={1: [CardType.LIBRARY_COMMITTEE]},
    ),
    "discipline-committee": ScenarioSpec(
        hands={0: [CardType.DISCIPLINE_COMMITTEE]},
    ),
    "news-club": ScenarioSpec(hands={0: [CardType.NEWS_CLUB]}),
    "rich-girl": ScenarioSpec(hands={0: [CardType.RICH_GIRL]}),
    "accomplice": ScenarioSpec(
        hands={0: [CardType.ACCOMPLICE]},
        doubts={1: [CardType.LIBRARY_COMMITTEE]},
    ),
    "infected": ScenarioSpec(
        hands={0: [CardType.INFECTED]},
        harmony=[CardType.STUDENT_COUNCIL_PRESIDENT],
    ),
    "class-representative": ScenarioSpec(hands={0: [CardType.CLASS_REP]}),
    "honor-student": ScenarioSpec(
        hands={
            0: [CardType.HONOR_STUDENT],
            1: [CardType.CRIMINAL],
            2: [CardType.ALIEN],
        },
    ),
}


def _take(deck: List[Card], card_type: CardType) -> Card:
    for index, card in enumerate(deck):
        if card.name == card_type:
            return deck.pop(index)
    raise ValueError(f"scenario requests unavailable card: {card_type.value}")


def _put_in_hand(card: Card, player_id: str) -> None:
    card.owner_id = player_id
    card.location = "hand"
    card.is_face_up = False
    card.target_player_id = None


def initialize_e2e_scenario(game: Game, scenario_name: str) -> None:
    """Replace *game* with one validated named four-player scenario state."""
    if scenario_name not in SCENARIOS:
        raise ValueError(f"unknown E2E scenario: {scenario_name}")
    if len(game.players) != 4:
        raise ValueError("deterministic E2E scenarios require exactly four players")

    spec = SCENARIOS[scenario_name]
    deck = create_card_deck(4)
    game.harmony_area = []
    for player in game.players:
        player.hand = []
        player.field_cards = []
        player.doubt_cards = []
        player.current_hand_count = 0

    for player_index, card_types in spec.hands.items():
        player = game.players[player_index]
        for card_type in card_types:
            card = _take(deck, card_type)
            _put_in_hand(card, player.id)
            player.hand.append(card)

    for card_type in spec.harmony:
        card = _take(deck, card_type)
        card.owner_id = None
        card.location = "harmony"
        card.is_face_up = False
        card.target_player_id = None
        game.harmony_area.append(card)

    for player_index, card_types in spec.fields.items():
        player = game.players[player_index]
        for card_type in card_types:
            card = _take(deck, card_type)
            card.owner_id = player.id
            card.location = "field"
            card.is_face_up = True
            player.field_cards.append(card)

    for player_index, card_types in spec.doubts.items():
        player = game.players[player_index]
        for card_type in card_types:
            card = _take(deck, card_type)
            card.owner_id = None
            card.location = "doubt"
            card.is_face_up = False
            card.target_player_id = player.id
            player.doubt_cards.append(card)

    # Three cards per player keeps every interaction away from settlement while
    # retaining a compact, readable hand in desktop and 844x390 recordings.
    for player in game.players:
        while len(player.hand) < 3:
            card = deck.pop(0)
            _put_in_hand(card, player.id)
            player.hand.append(card)
        player.current_hand_count = len(player.hand)

    game.harmony_area = list(game.harmony_area)
    game.state = GameState.PLAYING
    game.current_player_index = spec.actor
    game.turn_count = 0
    game.player_count = len(game.players)
    game.required_harmony_value = 6
    game.winner = None
    game.public_actions = []
