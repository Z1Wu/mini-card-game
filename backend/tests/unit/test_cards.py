import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from backend.game.cards import create_card_deck, CARD_DATABASE
from backend.game.models import CardType

@pytest.mark.unit
def test_create_card_deck():
    deck = create_card_deck()

    total_cards = sum(card_data["count"] for card_data in CARD_DATABASE.values())
    assert len(deck) == total_cards

    card_counts = {}
    for card in deck:
        card_counts[card.name] = card_counts.get(card.name, 0) + 1

    for card_type, card_data in CARD_DATABASE.items():
        assert card_counts.get(card_type, 0) == card_data["count"]

@pytest.mark.unit
def test_card_properties():
    deck = create_card_deck()

    class_rep_cards = [card for card in deck if card.name == CardType.CLASS_REP]
    assert len(class_rep_cards) == 2

    card = class_rep_cards[0]
    assert card.cost == 2
    assert card.harmony_value == 2
    assert card.victory_priority == 4

    alien_cards = [card for card in deck if card.name == CardType.ALIEN]
    assert len(alien_cards) == 1

    card = alien_cards[0]
    assert card.cost == -1
    assert card.harmony_value == 1
    assert card.victory_priority == 1

@pytest.mark.unit
def test_card_database():
    expected_cards = [
        CardType.CLASS_REP,
        CardType.LIBRARY_COMMITTEE,
        CardType.ALIEN,
        CardType.HOME_CLUB,
        CardType.HEALTH_COMMITTEE,
        CardType.DISCIPLINE_COMMITTEE,
        CardType.NEWS_CLUB,
        CardType.RICH_GIRL,
        CardType.ACCOMPLICE,
        CardType.INFECTED,
        CardType.CRIMINAL,
        CardType.STUDENT_COUNCIL_PRESIDENT,
        CardType.HONOR_STUDENT
    ]

    for card_type in expected_cards:
        assert card_type in CARD_DATABASE
