import pytest

from backend.game.cards import CARD_DATABASE
from backend.game.models import Card, CardType, Game, Player
from backend.game.victory import VictoryChecker


def make_card(card_type: CardType, suffix: str = "0") -> Card:
    data = CARD_DATABASE[card_type]
    return Card(
        id=f"{card_type.value}_{suffix}",
        name=card_type,
        description=data["description"],
        harmony_value=data["harmony_value"],
        victory_priority=data["victory_priority"],
        victory_condition=data["victory_condition"],
    )


def make_player(player_id: str, hand: list[CardType], doubts: list[CardType] | None = None) -> Player:
    return Player(
        id=player_id,
        name=player_id,
        hand=[make_card(card_type, f"{player_id}-{index}") for index, card_type in enumerate(hand)],
        doubt_cards=[
            make_card(card_type, f"doubt-{player_id}-{index}")
            for index, card_type in enumerate(doubts or [])
        ],
    )


def make_game(players: list[Player], harmony: list[CardType] | None = None) -> Game:
    return Game(
        id="victory-test",
        players=players,
        player_count=len(players),
        harmony_area=[make_card(card_type, f"harmony-{index}") for index, card_type in enumerate(harmony or [])],
        required_harmony_value=6,
    )


@pytest.mark.unit
@pytest.mark.parametrize(
    ("players", "harmony", "expected_winner"),
    [
        # Priority 1: an imprisoned Alien wins before every lower-priority card.
        (
            [
                make_player("alien", [CardType.ALIEN], [CardType.CLASS_REP]),
                make_player("fallback", [CardType.HOME_CLUB]),
            ],
            [],
            "alien",
        ),
        # Priority 2: Infected wins when harmony fails.
        (
            [
                make_player("infected", [CardType.INFECTED]),
                make_player("fallback", [CardType.HOME_CLUB]),
            ],
            [],
            "infected",
        ),
        # Priority 3: an un-imprisoned Criminal wins.
        (
            [
                make_player("criminal", [CardType.CRIMINAL]),
                make_player("fallback", [CardType.HOME_CLUB]),
            ],
            [],
            "criminal",
        ),
        # Priority 3: Accomplice wins when the imprisoned player is not the Criminal.
        (
            [
                make_player("accomplice", [CardType.ACCOMPLICE]),
                make_player("imprisoned", [CardType.CLASS_REP], [CardType.CLASS_REP]),
                make_player("fallback", [CardType.HOME_CLUB]),
            ],
            [],
            "accomplice",
        ),
        # Priority 4: harmony-side cards win once the target value is reached.
        (
            [
                make_player("harmony", [CardType.CLASS_REP]),
                make_player("fallback", [CardType.HOME_CLUB]),
            ],
            [CardType.STUDENT_COUNCIL_PRESIDENT, CardType.STUDENT_COUNCIL_PRESIDENT],
            "harmony",
        ),
        # Priority 5: Home Club is the fallback when priorities 1-4 do not win.
        (
            [
                make_player("harmony-failed", [CardType.CLASS_REP]),
                make_player("home", [CardType.HOME_CLUB]),
            ],
            [],
            "home",
        ),
    ],
)
def test_victory_priority_scenarios(players, harmony, expected_winner):
    assert VictoryChecker(make_game(players, harmony)).check_victory() == expected_winner


@pytest.mark.unit
def test_tied_imprisonment_is_reported_and_player_order_breaks_same_priority_tie():
    first = make_player("first", [CardType.ALIEN], [CardType.CLASS_REP])
    second = make_player("second", [CardType.ALIEN], [CardType.CLASS_REP])
    checker = VictoryChecker(make_game([first, second]))

    assert checker.check_victory() == "first"
    summary = checker.get_settlement_summary()
    assert summary["imprisoned_player_ids"] == ["first", "second"]
    assert summary["player_doubt_totals"] == {"first": 2, "second": 2}


@pytest.mark.unit
def test_non_positive_doubt_totals_do_not_imprison_anyone():
    player = make_player("player", [CardType.CRIMINAL], [CardType.ALIEN])
    checker = VictoryChecker(make_game([player]))

    assert checker.check_victory() == "player"
    assert checker.get_settlement_summary()["imprisoned_player_ids"] == []


@pytest.mark.unit
def test_settlement_summary_reports_harmony_total_and_threshold():
    players = [make_player("home", [CardType.HOME_CLUB])]
    checker = VictoryChecker(make_game(players, [CardType.CLASS_REP, CardType.STUDENT_COUNCIL_PRESIDENT]))

    checker.check_victory()
    summary = checker.get_settlement_summary()
    assert summary["harmony_total"] == 5
    assert summary["required_harmony_value"] == 6
    assert summary["harmony_reached"] is False
