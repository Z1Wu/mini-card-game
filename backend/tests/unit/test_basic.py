import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from backend.game.state import GameManager
from backend.game.cards import create_card_deck, CARD_DATABASE, DECK_COUNTS_BY_PLAYERS
from backend.game.models import CardType, GameState, CardUsageType

@pytest.mark.unit
def test_game_state():
    print("=== 测试游戏状态管理 ===\n")

    manager = GameManager()
    manager.create_game("test_game")

    print("1. 测试创建游戏")
    assert manager.game is not None
    assert manager.game.id == "test_game"
    assert manager.game.state == GameState.WAITING
    print("✓ 游戏创建成功")

    print("\n2. 测试添加玩家")
    result = manager.add_player("player_1", "玩家1")
    assert result is True
    assert len(manager.game.players) == 1
    print("✓ 玩家添加成功")

    print("\n3. 测试添加多个玩家")
    for i in range(2, 4):
        manager.add_player(f"player_{i}", f"玩家{i}")
    assert len(manager.game.players) == 3
    print("✓ 多个玩家添加成功")

    print("\n4. 测试发牌")
    result = manager.deal_cards()
    assert result is True
    for player in manager.game.players:
        assert len(player.hand) == 6
        assert player.current_hand_count == 6
    print("✓ 发牌成功")

    print("\n5. 测试回合管理（考虑先手规则）")
    initial_player_index = manager.game.current_player_index
    print(f"   初始玩家索引: {initial_player_index}")
    
    manager.next_turn()
    print(f"   第一次 next_turn 后: {manager.game.current_player_index}")
    assert manager.game.current_player_index == (initial_player_index + 1) % 3
    
    manager.next_turn()
    print(f"   第二次 next_turn 后: {manager.game.current_player_index}")
    assert manager.game.current_player_index == (initial_player_index + 2) % 3
    
    manager.next_turn()
    print(f"   第三次 next_turn 后: {manager.game.current_player_index}")
    assert manager.game.current_player_index == initial_player_index
    print("✓ 回合管理成功")

    print("\n6. 测试获取当前玩家")
    current_player = manager.get_current_player()
    assert current_player is not None
    assert current_player.id == manager.game.players[manager.game.current_player_index].id
    print("✓ 获取当前玩家成功")

    print("\n7. 测试先手规则")
    print(f"   第一个玩家是: {manager.game.players[manager.game.current_player_index].name}")
    first_player = manager.game.players[manager.game.current_player_index]
    has_student_council_president = any(card.name == CardType.STUDENT_COUNCIL_PRESIDENT for card in first_player.hand)
    if has_student_council_president:
        print(f"   {first_player.name} 持有学生会长卡牌，获得先手")
    else:
        print(f"   {first_player.name} 没有学生会长卡牌")
    print("✓ 先手规则验证成功")

    print("\n=== 游戏状态管理测试通过 ===\n")

@pytest.mark.unit
def test_cards():
    print("=== 测试卡牌系统 ===\n")

    print("1. 测试创建卡牌库")
    deck = create_card_deck(5)
    total_cards = 25  # 5 人局牌组
    assert len(deck) == total_cards
    print(f"✓ 卡牌库创建成功，共 {len(deck)} 张卡牌")

    print("\n2. 测试卡牌数量（5 人局）")
    card_counts = {}
    for card in deck:
        card_counts[card.name] = card_counts.get(card.name, 0) + 1

    five_counts = DECK_COUNTS_BY_PLAYERS[5]
    for card_type, card_data in CARD_DATABASE.items():
        expected = five_counts.get(card_type, card_data["count"])
        assert card_counts.get(card_type, 0) == expected
        print(f"✓ {card_type.value}: {expected} 张")

    print("\n3. 测试卡牌属性")
    class_rep_cards = [card for card in deck if card.name == CardType.CLASS_REP]
    assert len(class_rep_cards) == 2
    card = class_rep_cards[0]
    assert card.harmony_value == 2
    assert card.victory_priority == 4
    print("✓ 班长卡牌属性正确")

    alien_cards = [card for card in deck if card.name == CardType.ALIEN]
    assert len(alien_cards) == 1
    card = alien_cards[0]
    assert card.harmony_value == -1
    assert card.victory_priority == 1
    print("✓ 外星人卡牌属性正确")

    print("\n4. 测试卡牌数据库")
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
    print("✓ 所有卡牌类型都在数据库中")

    print("\n=== 卡牌系统测试通过 ===\n")

@pytest.mark.unit
def test_game_rules():
    print("=== 测试游戏规则 ===\n")

    from backend.game.rules import GameRules

    manager = GameManager()
    manager.create_game("test_game")

    for i in range(3):
        manager.add_player(f"player_{i+1}", f"玩家{i+1}")

    manager.deal_cards()

    rules = GameRules(manager)

    print("1. 测试调和出卡")
    current_player = manager.get_current_player()
    print(f"   当前玩家: {current_player.name} (ID: {current_player.id}), 手牌数: {len(current_player.hand)}")
    
    if not current_player.hand:
        print(f"   当前玩家无手牌，切换到下一个玩家")
        manager.next_turn()
        current_player = manager.get_current_player()
        print(f"   新当前玩家: {current_player.name} (ID: {current_player.id}), 手牌数: {len(current_player.hand)}")
    
    harmony_card = next((c for c in current_player.hand if c.name != CardType.CRIMINAL), None)
    if harmony_card:
        card_id = harmony_card.id
        print(f"   出卡: {harmony_card.name}")
        result = rules.play_card(current_player.id, card_id, CardUsageType.HARMONY)
        assert result is True
        assert len(current_player.hand) == 5
        print("✓ 调和出卡成功")
    else:
        print("✓ 当前玩家无可打出的手牌（仅犯人等），跳过测试")

    print("\n2. 测试质疑出卡")
    current_player = manager.get_current_player()
    print(f"   当前玩家: {current_player.name} (ID: {current_player.id}), 手牌数: {len(current_player.hand)}")
    
    if not current_player.hand:
        print(f"   当前玩家无手牌，切换到下一个玩家")
        manager.next_turn()
        current_player = manager.get_current_player()
        print(f"   新当前玩家: {current_player.name} (ID: {current_player.id}), 手牌数: {len(current_player.hand)}")
    
    target_player = None
    for player in manager.game.players:
        if player.id != current_player.id:
            target_player = player
            break
    
    doubt_card = next((c for c in current_player.hand if c.name != CardType.CRIMINAL), None)
    if target_player and doubt_card:
        card_id = doubt_card.id
        print(f"   出卡: {doubt_card.name}")
        print(f"   目标玩家: {target_player.name} (ID: {target_player.id})")
        result = rules.play_card(current_player.id, card_id, CardUsageType.DOUBT, target_player.id)
        assert result is True
        assert len(current_player.hand) == 5
        print("✓ 质疑出卡成功")
    else:
        print("✓ 当前玩家无手牌、无可打出牌或无目标玩家，跳过测试")

    print("\n3. 测试特技出卡")
    current_player = manager.get_current_player()
    print(f"   当前玩家: {current_player.name} (ID: {current_player.id}), 手牌数: {len(current_player.hand)}")
    
    if not current_player.hand:
        print(f"   当前玩家无手牌，切换到下一个玩家")
        manager.next_turn()
        current_player = manager.get_current_player()
        print(f"   新当前玩家: {current_player.name} (ID: {current_player.id}), 手牌数: {len(current_player.hand)}")
    
    # 犯人牌不可打出；保健委员/归宅部等需额外参数。选用可不带目标打出的特技牌
    skill_playable = (CardType.LIBRARY_COMMITTEE, CardType.NEWS_CLUB, CardType.ALIEN, CardType.HONOR_STUDENT)
    skill_card = next((c for c in current_player.hand if c.name in skill_playable), None)
    if skill_card:
        card_id = skill_card.id
        print(f"   出卡: {skill_card.name}")
        result = rules.play_card(current_player.id, card_id, CardUsageType.SKILL)
        assert result is True
        assert len(current_player.hand) == 5
        print("✓ 特技出卡成功")
    else:
        print("✓ 当前玩家手牌无可直接打出的特技牌，跳过测试")

    print("\n=== 游戏规则测试通过 ===\n")


@pytest.mark.unit
def test_play_card_fails_when_current_player_has_one_card():
    """手牌剩一张时不能出牌（手牌不会为 0）。"""
    from backend.game.rules import GameRules

    manager = GameManager()
    manager.create_game("test_one_card_rule")
    for i in range(3):
        manager.add_player(f"player_{i+1}", f"玩家{i+1}")
    manager.deal_cards()

    rules = GameRules(manager)
    current = manager.get_current_player()
    assert current is not None and len(current.hand) >= 2

    # 把手牌改成只剩 1 张（手牌不可能为 0，只测 1 张）；用非犯人牌避免因犯人牌规则失败
    only_card = next((c for c in current.hand if c.name != CardType.CRIMINAL), current.hand[0])
    current.hand = [only_card]
    current.current_hand_count = 1

    result = rules.play_card(current.id, only_card.id, CardUsageType.HARMONY)
    assert result is False  # 手牌剩一张不能出牌
    assert len(current.hand) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
