from random import Random
from typing import Optional
from .models import Game, Player, Card, GameState, CardType


HAND_COUNT_BY_PLAYERS = {3: 6, 4: 6, 5: 5}
MIN_PLAYERS = min(HAND_COUNT_BY_PLAYERS)
MAX_PLAYERS = max(HAND_COUNT_BY_PLAYERS)

class GameManager:
    def __init__(self, rng: Optional[Random] = None):
        self.game: Optional[Game] = None
        self._rng = rng or Random()

    def create_game(self, game_id: str) -> Game:
        self.game = Game(id=game_id)
        return self.game

    def add_player(self, player_id: str, player_name: str) -> bool:
        if not self.game or self.game.state != GameState.WAITING:
            return False
        if not player_id or not player_name:
            return False
        if any(player.id == player_id for player in self.game.players):
            return False
        if len(self.game.players) >= MAX_PLAYERS:
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
        if len(self.game.players) not in HAND_COUNT_BY_PLAYERS:
            logger.warning(f"不支持的玩家数量: {len(self.game.players)}")
            return False
        
        result = self.deal_cards()
        logger.info(f"deal_cards 返回: {result}")
        return result

    def deal_cards(self) -> bool:
        if not self.game or self.game.state != GameState.WAITING:
            return False

        # 与 overview 一致：仅支持 3–5 人；3–4 人每人 6 张，5 人 5 张
        n = len(self.game.players)
        hand_count = HAND_COUNT_BY_PLAYERS.get(n)
        if hand_count is None:
            return False

        from .cards import create_card_deck
        deck = create_card_deck(n)
        self._rng.shuffle(deck)

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

    def reset_game(self) -> bool:
        """清除所有对局状态，保留当前玩家列表，回到等待开始状态。"""
        import logging
        logger = logging.getLogger(__name__)
        if not self.game:
            logger.warning("reset_game: 游戏不存在")
            return False
        self.game.harmony_area = []
        for player in self.game.players:
            player.hand = []
            player.field_cards = []
            player.doubt_cards = []
            player.current_hand_count = 0
        self.game.state = GameState.WAITING
        self.game.current_player_index = 0
        self.game.turn_count = 0
        self.game.winner = None
        self.game.required_harmony_value = 0
        logger.info("reset_game: 已清除状态，回到等待开始")
        return True
