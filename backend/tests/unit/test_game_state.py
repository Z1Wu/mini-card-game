import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from backend.game.state import GameManager
from backend.game.models import GameState, CardType

@pytest.fixture
def game_manager():
    manager = GameManager()
    manager.create_game("test_game")
    return manager

@pytest.mark.unit
def test_create_game(game_manager):
    assert game_manager.game is not None
    assert game_manager.game.id == "test_game"
    assert game_manager.game.state == GameState.WAITING

@pytest.mark.unit
def test_add_player(game_manager):
    result = game_manager.add_player("player_1", "玩家1")
    assert result is True
    assert len(game_manager.game.players) == 1
    assert game_manager.game.players[0].id == "player_1"

@pytest.mark.unit
def test_add_too_many_players(game_manager):
    for i in range(5):
        game_manager.add_player(f"player_{i+1}", f"玩家{i+1}")

    result = game_manager.add_player("player_6", "玩家6")
    assert result is False
    assert len(game_manager.game.players) == 5

@pytest.mark.unit
def test_remove_player(game_manager):
    game_manager.add_player("player_1", "玩家1")
    game_manager.add_player("player_2", "玩家2")

    result = game_manager.remove_player("player_1")
    assert result is True
    assert len(game_manager.game.players) == 1
    assert game_manager.game.players[0].id == "player_2"

@pytest.mark.unit
def test_deal_cards(game_manager):
    for i in range(3):
        game_manager.add_player(f"player_{i+1}", f"玩家{i+1}")

    result = game_manager.deal_cards()
    assert result is True

    for player in game_manager.game.players:
        assert len(player.hand) == 6
        assert player.current_hand_count == 6


@pytest.mark.unit
def test_deal_cards_hand_count_by_players():
    """3/4/5 人时每人手牌数：3–4 人 6 张，5 人 5 张（与 overview 一致，最多 5 人）"""
    manager = GameManager()
    manager.create_game("test")
    expected = {3: 6, 4: 6, 5: 5}
    for n, want in expected.items():
        manager.create_game(f"test_{n}")
        for i in range(n):
            manager.add_player(f"p{i}_{n}", f"玩家{i+1}")
        assert manager.deal_cards() is True
        for p in manager.game.players:
            assert len(p.hand) == want, f"n={n} expected {want} cards per player"
            assert p.current_hand_count == want

@pytest.mark.unit
def test_next_turn(game_manager):
    for i in range(3):
        game_manager.add_player(f"player_{i+1}", f"玩家{i+1}")

    game_manager.deal_cards()

    # 先手为持有学生会长卡的玩家（发牌随机，不假定是 player_1）
    n = game_manager.game.player_count
    first = game_manager.game.current_player_index
    assert 0 <= first < n

    game_manager.next_turn()
    assert game_manager.game.current_player_index == (first + 1) % n

    game_manager.next_turn()
    assert game_manager.game.current_player_index == (first + 2) % n

    game_manager.next_turn()
    assert game_manager.game.current_player_index == first

@pytest.mark.unit
def test_get_current_player(game_manager):
    for i in range(3):
        game_manager.add_player(f"player_{i+1}", f"玩家{i+1}")

    game_manager.deal_cards()

    current_player = game_manager.get_current_player()
    assert current_player is not None
    # 当前玩家应为 current_player_index 所指（先手为持学生会长者）
    assert current_player.id == game_manager.game.players[game_manager.game.current_player_index].id


@pytest.mark.unit
def test_next_turn_skips_player_with_one_card_and_ends_when_all_have_one():
    """手牌剩一张的玩家不能出牌，next_turn 会跳过他们；当所有人手牌都剩一张时进入 GAME_OVER。"""
    manager = GameManager()
    manager.create_game("test_one_card")
    for i in range(3):
        manager.add_player(f"player_{i+1}", f"玩家{i+1}")
    manager.deal_cards()

    n = manager.game.player_count
    idx = manager.game.current_player_index

    # 把当前玩家手牌改成只剩 1 张
    manager.game.players[idx].hand = manager.game.players[idx].hand[:1]
    manager.game.players[idx].current_hand_count = 1

    # next_turn 应跳过该玩家，轮到下一位（若下一位手牌>1）
    ok = manager.next_turn()
    assert ok is True
    # 当前应变为下一人，且若下一人 hand > 1 则停在他身上
    next_idx = manager.game.current_player_index
    assert next_idx != idx
    if len(manager.game.players[next_idx].hand) > 1:
        assert manager.game.state != GameState.GAME_OVER
    # 若把所有人都改成 1 张，再 next_turn 应进入 GAME_OVER
    for p in manager.game.players:
        p.hand = p.hand[:1] if p.hand else p.hand
        p.current_hand_count = len(p.hand)
    manager.game.state = GameState.PLAYING
    manager.game.current_player_index = 0
    ok = manager.next_turn()
    assert ok is True
    assert manager.game.state == GameState.GAME_OVER
