from typing import List, Optional
from .models import Game, Player, Card, CardType

class VictoryChecker:
    def __init__(self, game: Game):
        self.game = game

    def check_victory(self) -> Optional[str]:
        if self._check_harmony_victory():
            return self._get_harmony_winner()

        imprisoned_player = self._check_doubt_settlement()
        if imprisoned_player:
            if self._check_alien_victory(imprisoned_player):
                return imprisoned_player.id

            if self._check_criminal_victory(imprisoned_player):
                return self._get_criminal_winner()

        return self._check_all_victory_conditions()

    def _check_harmony_victory(self) -> bool:
        total_harmony = sum(card.harmony_value for card in self.game.harmony_area)
        return total_harmony >= self.game.required_harmony_value

    def _get_harmony_winner(self) -> Optional[str]:
        winners = []
        for player in self.game.players:
            if self._player_meets_harmony_condition(player):
                winners.append(player.id)

        if len(winners) == 1:
            return winners[0]

        return self._select_winner_by_priority(winners)

    def _player_meets_harmony_condition(self, player: Player) -> bool:
        for card in player.hand:
            if card.victory_condition == "4 调和成功即可获胜":
                return True
        return False

    def _check_doubt_settlement(self) -> Optional[Player]:
        player_doubt_values = {}
        for player in self.game.players:
            total_value = sum(card.harmony_value for card in player.doubt_cards)
            player_doubt_values[player.id] = total_value

        max_value = max(player_doubt_values.values())
        max_players = [pid for pid, value in player_doubt_values.items() if value == max_value]

        if len(max_players) == 1:
            return self._get_player(max_players[0])

        return None

    def _check_alien_victory(self, imprisoned_player: Player) -> bool:
        for card in imprisoned_player.hand:
            if card.name == CardType.ALIEN:
                return True
        return False

    def _check_criminal_victory(self, imprisoned_player: Player) -> bool:
        for card in imprisoned_player.hand:
            if card.name == CardType.CRIMINAL:
                return False
        return True

    def _get_criminal_winner(self) -> Optional[str]:
        for player in self.game.players:
            for card in player.hand:
                if card.name == CardType.ACCOMPLICE:
                    return player.id
        return None

    def _check_all_victory_conditions(self) -> Optional[str]:
        players_by_priority = self._sort_players_by_victory_priority()

        for player in players_by_priority:
            if self._check_player_victory_condition(player):
                return player.id

        return None

    def _sort_players_by_victory_priority(self) -> List[Player]:
        players_with_priority = []
        for player in self.game.players:
            min_priority = float('inf')
            for card in player.hand:
                if card.victory_priority < min_priority:
                    min_priority = card.victory_priority
            players_with_priority.append((min_priority, player))

        players_with_priority.sort(key=lambda x: x[0])
        return [player for _, player in players_with_priority]

    def _check_player_victory_condition(self, player: Player) -> bool:
        for card in player.hand:
            if self._check_card_victory_condition(card, player):
                return True
        return False

    def _check_card_victory_condition(self, card: Card, player: Player) -> bool:
        condition = card.victory_condition

        if condition == "1 被监禁即可获胜":
            return self._is_player_imprisoned(player)
        elif condition == "2 调和失败即可获胜":
            return not self._check_harmony_victory()
        elif condition == "3 不被监禁即可获胜":
            return not self._is_player_imprisoned(player)
        elif condition == "3 犯人获胜即可获胜":
            return self._check_criminal_victory(player)
        elif condition == "4 调和成功即可获胜":
            return self._check_harmony_victory()
        elif condition == "5 没有任何人获胜即可获胜":
            return True

        return False

    def _is_player_imprisoned(self, player: Player) -> bool:
        return False

    def _get_player(self, player_id: str) -> Optional[Player]:
        for player in self.game.players:
            if player.id == player_id:
                return player
        return None
