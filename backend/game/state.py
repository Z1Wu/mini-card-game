import random
from typing import Optional
from .models import Game, Player, Card, GameState, CardType

class GameManager:
    def __init__(self):
        self.game: Optional[Game] = None

    def create_game(self, game_id: str) -> Game:
        self.game = Game(id=game_id)
        return self.game

    def add_player(self, player_id: str, player_name: str) -> bool:
        if not self.game:
            return False
        if len(self.game.players) >= 5:
            return False

        player = Player(id=player_id, name=player_name)
        self.game.players.append(player)
        self.game.player_count = len(self.game.players)
        return True

    def remove_player(self, player_id: str) -> bool:
        if not self.game:
            return False

        self.game.players = [p for p in self.game.players if p.id != player_id]
        self.game.player_count = len(self.game.players)
        return True

    def start_game(self) -> bool:
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"start_game 被调用: game exists={self.game is not None}, players={len(self.game.players) if self.game else 0}")
        
        if not self.game:
            logger.warning("游戏不存在")
            return False
        if len(self.game.players) < 3:
            logger.warning(f"玩家数量不足: {len(self.game.players)}")
            return False
        
        result = self.deal_cards()
        logger.info(f"deal_cards 返回: {result}")
        return result

    def deal_cards(self) -> bool:
        if not self.game or self.game.state != GameState.WAITING:
            return False

        # 与 overview 一致：仅支持 3–5 人；3–4 人每人 6 张，5 人 5 张
        n = len(self.game.players)
        hand_count_map = {3: 6, 4: 6, 5: 5}
        hand_count = hand_count_map.get(n)
        if hand_count is None:
            return False

        from .cards import create_card_deck
        deck = create_card_deck(n)
        random.shuffle(deck)

        for player in self.game.players:
            player.hand = deck[:hand_count]
            deck = deck[hand_count:]
            player.current_hand_count = len(player.hand)

        self._set_first_player()
        self._set_required_harmony_value()
        self.game.state = GameState.PLAYING
        return True

    def _set_first_player(self):
        for i, player in enumerate(self.game.players):
            for card in player.hand:
                if card.name == CardType.STUDENT_COUNCIL_PRESIDENT:
                    self.game.current_player_index = i
                    return

    def _set_required_harmony_value(self):
        # 与 overview 一致：3/4/5 人游玩时调和目标值均为 6 点
        self.game.required_harmony_value = 6

    def get_current_player(self) -> Optional[Player]:
        if not self.game:
            return None
        return self.game.players[self.game.current_player_index]

    def next_turn(self) -> bool:
        if not self.game or self.game.state != GameState.PLAYING:
            return False

        n = self.game.player_count
        # 手牌已剩 1 张的玩家不能再出牌，自动跳过直到找到可出牌者或全员都只剩 1 张（则进入胜利判定）
        while True:
            self.game.current_player_index = (self.game.current_player_index + 1) % n
            self.game.turn_count += 1
            if self._check_game_end_condition():
                self.game.state = GameState.GAME_OVER
                return True
            current = self.game.players[self.game.current_player_index]
            if len(current.hand) > 1:
                break
        return True

    def _check_game_end_condition(self) -> bool:
        for player in self.game.players:
            if len(player.hand) > 1:
                return False
        return True
