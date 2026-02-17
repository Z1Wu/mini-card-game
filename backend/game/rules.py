import logging
from typing import Optional
from .models import Card, CardUsageType, Player, Game, GameState, CardType

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

class GameRules:
    def __init__(self, game_manager):
        self.game_manager = game_manager

    def play_card(self, player_id: str, card_id: str, usage_type: CardUsageType, target_player_id: Optional[str] = None) -> bool:
        logger.info(f"play_card 被调用: player_id={player_id}, card_id={card_id}, usage_type={usage_type}, target_player_id={target_player_id}")
        
        game = self.game_manager.game
        if not game or game.state != GameState.PLAYING:
            logger.warning(f"游戏不存在或未开始: game={game}, state={game.state if game else None}")
            return False

        player = self._get_player(player_id)
        if not player:
            logger.warning(f"玩家不存在: player_id={player_id}")
            return False

        current_player = game.players[game.current_player_index]
        if player.id != current_player.id:
            logger.warning(f"不是当前玩家: player_id={player_id}, current_player_id={current_player.id}")
            return False

        card = self._find_card_in_hand(player, card_id)
        if not card:
            logger.warning(f"卡牌不在手牌中: player_id={player_id}, card_id={card_id}")
            return False

        logger.info(f"卡牌信息: name={card.name}, cost={card.cost}, harmony_value={card.harmony_value}")

        if usage_type == CardUsageType.SKILL:
            logger.info("执行特技出卡")
            return self._play_skill_card(player, card, target_player_id)
        elif usage_type == CardUsageType.HARMONY:
            logger.info("执行调和出卡")
            return self._play_harmony_card(player, card)
        elif usage_type == CardUsageType.DOUBT:
            logger.info("执行质疑出卡")
            return self._play_doubt_card(player, card, target_player_id)
        else:
            logger.error(f"未知的出卡方式: usage_type={usage_type}")
            return False

    def _play_skill_card(self, player: Player, card: Card, target_player_id: Optional[str]) -> bool:
        logger.info(f"执行特技卡: {card.name}")
        game = self.game_manager.game

        if card.name == CardType.HONOR_STUDENT:
            return self._handle_honor_student_skill(player, card)

        if card.name == CardType.ALIEN:
            return self._handle_alien_skill(player, card)

        player.hand = [c for c in player.hand if c.id != card.id]
        player.current_hand_count = len(player.hand)

        card.is_face_up = True
        card.location = "field"
        player.field_cards.append(card)

        self._execute_card_effect(player, card, target_player_id)
        self.game_manager.next_turn()
        logger.info("特技出卡成功")
        return True

    def _play_harmony_card(self, player: Player, card: Card) -> bool:
        logger.info(f"执行调和卡: {card.name}, harmony_value={card.harmony_value}")
        game = self.game_manager.game

        player.hand = [c for c in player.hand if c.id != card.id]
        player.current_hand_count = len(player.hand)

        card.is_face_up = False
        card.location = "harmony"
        game.harmony_area.append(card)

        self.game_manager.next_turn()
        logger.info(f"调和出卡成功, 当前调和区卡牌数: {len(game.harmony_area)}")
        return True

    def _play_doubt_card(self, player: Player, card: Card, target_player_id: str) -> bool:
        logger.info(f"执行质疑卡: {card.name}, target_player_id={target_player_id}")
        game = self.game_manager.game

        if target_player_id == player.id:
            logger.warning(f"不能质疑自己: target_player_id={target_player_id}")
            return False

        target_player = self._get_player(target_player_id)
        if not target_player:
            logger.warning(f"目标玩家不存在: target_player_id={target_player_id}")
            return False

        player.hand = [c for c in player.hand if c.id != card.id]
        player.current_hand_count = len(player.hand)

        card.is_face_up = False
        card.location = "doubt"
        card.target_player_id = target_player_id
        target_player.doubt_cards.append(card)

        self.game_manager.next_turn()
        logger.info(f"质疑出卡成功, 目标玩家质疑区卡牌数: {len(target_player.doubt_cards)}")
        return True

    def _handle_honor_student_skill(self, player: Player, card: Card) -> bool:
        logger.info(f"处理优等生特技: {card.name}")
        game = self.game_manager.game

        player.hand = [c for c in player.hand if c.id != card.id]
        player.current_hand_count = len(player.hand)

        card.is_face_up = True
        card.location = "field"
        player.field_cards.append(card)

        game.state = GameState.SPECIAL_PHASE
        logger.info("游戏进入特殊阶段（优等生特技）")
        return True

    def _handle_alien_skill(self, player: Player, card: Card) -> bool:
        logger.info(f"处理外星人特技: {card.name}")
        game = self.game_manager.game

        player.hand = [c for c in player.hand if c.id != card.id]
        player.current_hand_count = len(player.hand)

        card.is_face_up = True
        card.location = "field"
        player.field_cards.append(card)

        self.game_manager.next_turn()
        logger.info("外星人特技出卡成功（无特殊效果）")
        return True

    def _execute_card_effect(self, player: Player, card: Card, target_player_id: Optional[str]):
        logger.info(f"执行卡牌效果: {card.name}, target_player_id={target_player_id}")
        if card.name == CardType.CLASS_REP:
            self._effect_class_rep(player, target_player_id)
        elif card.name == CardType.LIBRARY_COMMITTEE:
            self._effect_library_committee(player)
        elif card.name == CardType.HEALTH_COMMITTEE:
            self._effect_health_committee(player, target_player_id)
        elif card.name == CardType.DISCIPLINE_COMMITTEE:
            self._effect_discipline_committee(player, target_player_id)
        elif card.name == CardType.NEWS_CLUB:
            self._effect_news_club()
        elif card.name == CardType.RICH_GIRL:
            self._effect_rich_girl(player, target_player_id)
        elif card.name == CardType.ACCOMPLICE:
            self._effect_accomplice(player, target_player_id)
        elif card.name == CardType.HOME_CLUB:
            self._effect_home_club(player, target_player_id)
        else:
            logger.warning(f"卡牌效果未实现: {card.name}")

    def _effect_class_rep(self, player: Player, target_player_id: str):
        logger.info(f"执行班长效果: target_player_id={target_player_id}")
        target_player = self._get_player(target_player_id)
        if not target_player:
            logger.warning(f"目标玩家不存在: target_player_id={target_player_id}")
            return

        if player.hand and target_player.hand:
            logger.info(f"交换手牌: player={player.name}, target={target_player.name}")
            player.hand[0], target_player.hand[0] = target_player.hand[0], player.hand[0]
            player.current_hand_count = len(player.hand)
            target_player.current_hand_count = len(target_player.hand)
            logger.info(f"交换后手牌数: player={player.current_hand_count}, target={target_player.current_hand_count}")

    def _effect_library_committee(self, player: Player):
        logger.info(f"执行图书委员效果: player={player.name}")
        pass

    def _effect_health_committee(self, player: Player, target_player_id: str):
        logger.info(f"执行保健委员效果: player={player.name}, target_player_id={target_player_id}")
        target_player = self._get_player(target_player_id)
        if not target_player or not target_player.field_cards:
            logger.warning(f"目标玩家不存在或无场牌: target_player_id={target_player_id}")
            return

        card = target_player.field_cards.pop(0)
        card.location = "hand"
        player.hand.append(card)
        player.current_hand_count = len(player.hand)
        logger.info(f"保健委员效果完成, 目标玩家手牌数: {target_player.current_hand_count}")

    def _effect_discipline_committee(self, player: Player, target_player_id: str):
        logger.info(f"执行风纪委员效果: player={player.name}, target_player_id={target_player_id}")
        pass

    def _effect_news_club(self):
        logger.info("执行新闻部效果")
        game = self.game_manager.game
        if not game or len(game.players) < 2:
            logger.warning(f"游戏不存在或玩家不足: game={game}, player_count={len(game.players) if game else 0}")
            return

        n = len(game.players)
        logger.info(f"新闻部效果: 玩家数={n}")
        for i in range(n):
            current_player = game.players[i]
            next_player = game.players[(i + 1) % n]
            logger.info(f"交换: {current_player.name} -> {next_player.name}")

            if current_player.hand:
                card = current_player.hand.pop(0)
                next_player.hand.append(card)
                logger.info(f"{current_player.name} 给 {next_player.name} 一张卡")

            current_player.current_hand_count = len(current_player.hand)
            next_player.current_hand_count = len(next_player.hand)
            logger.info(f"交换后: {current_player.name}={current_player.current_hand_count}, {next_player.name}={next_player.current_hand_count}")

    def _effect_rich_girl(self, player: Player, target_player_id: str):
        logger.info(f"执行大小姐效果: player={player.name}, target_player_id={target_player_id}")
        target_player = self._get_player(target_player_id)
        if not target_player or not target_player.hand:
            logger.warning(f"目标玩家不存在或无手牌: target_player_id={target_player_id}")
            return

        card_from_target = target_player.hand.pop(0)
        player.hand.append(card_from_target)
        logger.info(f"{target_player.name} 给 {player.name} 一张卡")

        if player.hand:
            card_to_target = player.hand.pop(0)
            target_player.hand.append(card_to_target)
            logger.info(f"{player.name} 给 {target_player.name} 一张卡")

        player.current_hand_count = len(player.hand)
        target_player.current_hand_count = len(target_player.hand)
        logger.info(f"大小姐效果完成: player={player.current_hand_count}, target={target_player.current_hand_count}")

    def _effect_accomplice(self, player: Player, target_player_id: str):
        logger.info(f"执行共犯效果: player={player.name}, target_player_id={target_player_id}")
        if not player.doubt_cards:
            logger.warning(f"玩家无质疑卡: player={player.name}")
            return

        target_player = self._get_player(target_player_id)
        if not target_player or target_player_id == player.id:
            logger.warning(f"目标玩家无效: target_player_id={target_player_id}")
            return

        card = player.doubt_cards.pop(0)
        target_player.doubt_cards.append(card)
        logger.info(f"共犯效果完成: 目标玩家质疑区卡牌数={len(target_player.doubt_cards)}")

    def _effect_home_club(self, player: Player, target_player_id: str):
        logger.info(f"执行归宅部效果: player={player.name}, target_player_id={target_player_id}")
        game = self.game_manager.game
        if not game or not game.harmony_area:
            logger.warning(f"游戏不存在或无调和区: game={game}, harmony_area_count={len(game.harmony_area) if game else 0}")
            return

        if not player.hand:
            logger.warning(f"玩家无手牌: player={player.name}")
            return

        hand_card = player.hand.pop(0)
        harmony_card = game.harmony_area.pop(0)
        logger.info(f"交换: 手牌={hand_card.name} <-> 调和区={harmony_card.name}")

        hand_card.location = "harmony"
        game.harmony_area.append(hand_card)

        harmony_card.location = "hand"
        player.hand.append(harmony_card)

        player.current_hand_count = len(player.hand)
        logger.info(f"归宅部效果完成: 玩家手牌数={player.current_hand_count}, 调和区卡牌数={len(game.harmony_area)}")

    def _get_player(self, player_id: str) -> Optional[Player]:
        game = self.game_manager.game
        if not game:
            logger.warning(f"游戏不存在: player_id={player_id}")
            return None
        for player in game.players:
            if player.id == player_id:
                return player
        logger.warning(f"玩家未找到: player_id={player_id}")
        return None

    def _find_card_in_hand(self, player: Player, card_id: str) -> Optional[Card]:
        for card in player.hand:
            if card.id == card_id:
                return card
        logger.warning(f"手牌中未找到卡牌: player_id={player.id}, card_id={card_id}")
        return None
