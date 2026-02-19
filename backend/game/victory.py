from typing import Optional
from .models import Game, Player, Card, CardType


class VictoryChecker:
    """按 overview 规则：所有人只剩一张手牌后，先做判定1（调和值）、判定2（质疑结算），再按胜利优先级 1→5 依次判定。"""

    def __init__(self, game: Game):
        self.game = game
        self._harmony_reached = False
        self._imprisoned_player: Optional[Player] = None

    def check_victory(self) -> Optional[str]:
        # 判定 1：调和值是否达到
        self._harmony_reached = self._check_harmony_value_reached()
        # 判定 2：质疑结算，确定被监禁者（质疑区数值总和最大且唯一）
        self._imprisoned_player = self._check_doubt_settlement()

        # 判定 3：按胜利优先级 1→5 依次公开手牌，先满足条件者胜
        for priority in [1, 2, 3, 4, 5]:
            winner = self._find_winner_at_priority(priority)
            if winner:
                return winner
        return None

    def _check_harmony_value_reached(self) -> bool:
        """判定 1：调和区数值总和是否达到游戏人数对应的要求。"""
        total = sum(card.harmony_value for card in self.game.harmony_area)
        return total >= self.game.required_harmony_value

    def _check_doubt_settlement(self) -> Optional[Player]:
        """判定 2：质疑结算，数值总和最大的唯一玩家视为被监禁。"""
        player_doubt_values = {}
        for player in self.game.players:
            total_value = sum(card.harmony_value for card in player.doubt_cards)
            player_doubt_values[player.id] = total_value

        if not player_doubt_values:
            return None
        max_value = max(player_doubt_values.values())
        max_players = [pid for pid, value in player_doubt_values.items() if value == max_value]
        if len(max_players) != 1:
            return None
        return self._get_player(max_players[0])

    def _find_winner_at_priority(self, priority: int) -> Optional[str]:
        """在给定胜利优先级下，按玩家顺序检查，先满足条件者胜。"""
        # 手牌中拥有该优先级卡牌的玩家，按在 game.players 中的顺序
        players_with_priority = []
        for i, player in enumerate(self.game.players):
            for card in player.hand:
                if card.victory_priority == priority:
                    players_with_priority.append((i, player))
                    break
        players_with_priority.sort(key=lambda x: x[0])

        for _, player in players_with_priority:
            for card in player.hand:
                if card.victory_priority != priority:
                    continue
                if self._check_card_victory_condition(card, player):
                    return player.id
        return None

    def _check_card_victory_condition(self, card: Card, player: Player) -> bool:
        """根据卡牌胜利条件文案，结合已算出的调和/监禁结果判定是否满足。"""
        condition = card.victory_condition

        if condition == "1 被监禁即可获胜":
            return self._is_player_imprisoned(player)
        if condition == "2 调和失败即可获胜":
            return not self._harmony_reached
        if condition == "3 不被监禁即可获胜":
            return not self._is_player_imprisoned(player)
        if condition == "3 犯人获胜即可获胜":
            return self._check_criminal_side_wins()
        if condition == "4 调和成功即可获胜":
            return self._harmony_reached
        if condition == "5 没有任何人获胜即可获胜":
            return True  # 已按优先级 1→5 检查，能到 5 表示无人 1→4 满足，即“无任何人胜利”

        return False

    def _is_player_imprisoned(self, player: Player) -> bool:
        """该玩家是否为判定 2 确定的被监禁者。"""
        return self._imprisoned_player is not None and player.id == self._imprisoned_player.id

    def _check_criminal_side_wins(self) -> bool:
        """犯人方获胜：存在被监禁者且被监禁者手牌中没有犯人。"""
        if self._imprisoned_player is None:
            return False
        for card in self._imprisoned_player.hand:
            if card.name == CardType.CRIMINAL:
                return False
        return True

    def _get_player(self, player_id: str) -> Optional[Player]:
        for player in self.game.players:
            if player.id == player_id:
                return player
        return None
