import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from backend.game.cards import create_card_deck, CARD_DATABASE, DECK_COUNTS_BY_PLAYERS
from backend.game.models import CardType

@pytest.mark.unit
def test_create_card_deck():
    """5 人局牌组 25 张，与 overview 五人卡牌类型一致（含图书委员 3 张）"""
    deck = create_card_deck(5)
    assert len(deck) == 25
    card_counts = {}
    for card in deck:
        card_counts[card.name] = card_counts.get(card.name, 0) + 1
    for card_type, count in DECK_COUNTS_BY_PLAYERS[5].items():
        assert card_counts.get(card_type, 0) == count
    # 未在 DECK_COUNTS_BY_PLAYERS 中列出的类型用 CARD_DATABASE 默认
    for card_type, card_data in CARD_DATABASE.items():
        if card_type not in DECK_COUNTS_BY_PLAYERS[5]:
            assert card_counts.get(card_type, 0) == card_data["count"]


@pytest.mark.unit
def test_create_card_deck_by_players():
    """3 人 18 张（无共犯）、4 人 24 张、5 人 25 张（图书委员 3）"""
    assert len(create_card_deck(3)) == 18
    assert len(create_card_deck(4)) == 24
    assert len(create_card_deck(5)) == 25
    deck5 = create_card_deck(5)
    library_count = sum(1 for c in deck5 if c.name == CardType.LIBRARY_COMMITTEE)
    assert library_count == 3
    deck3 = create_card_deck(3)
    accomplice_count = sum(1 for c in deck3 if c.name == CardType.ACCOMPLICE)
    assert accomplice_count == 0

@pytest.mark.unit
def test_card_properties():
    deck = create_card_deck(5)

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
