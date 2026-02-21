import logging
from typing import Optional
from .models import Card, CardUsageType, Player, Game, GameState, CardType

logger = logging.getLogger(__name__)

class GameRules:
    def __init__(self, game_manager):
        self.game_manager = game_manager

    def play_card(
        self,
        player_id: str,
        card_id: str,
        usage_type: CardUsageType,
        target_player_id: Optional[str] = None,
        target_card_id: Optional[str] = None,
        hand_card_id: Optional[str] = None,
        harmony_card_id: Optional[str] = None,
    ) -> bool:
        logger.info(f"play_card 被调用: player_id={player_id}, card_id={card_id}, usage_type={usage_type}, target_player_id={target_player_id}, target_card_id={target_card_id}, hand_card_id={hand_card_id}, harmony_card_id={harmony_card_id}")
        
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

        if len(current_player.hand) <= 1:
            logger.warning("手牌已剩一张，本回合不能出牌")
            return False

        card = self._find_card_in_hand(player, card_id)
        if not card:
            logger.warning(f"卡牌不在手牌中: player_id={player_id}, card_id={card_id}")
            return False

        if card.name == CardType.CRIMINAL:
            logger.warning("犯人牌不可打出，仅可被其他卡牌效果移动")
            return False

        logger.info(f"卡牌信息: name={card.name}, cost={card.cost}, harmony_value={card.harmony_value}")

        if card.name == CardType.HEALTH_COMMITTEE and usage_type == CardUsageType.SKILL:
            if not target_player_id or not target_card_id:
                logger.warning("保健委员特技需要指定目标玩家及目标场牌")
                return False
            target = self._get_player(target_player_id)
            if not target or not any(c.id == target_card_id for c in target.field_cards):
                logger.warning(f"保健委员：目标场牌无效 target_player_id={target_player_id}, target_card_id={target_card_id}")
                return False

        if card.name == CardType.HOME_CLUB and usage_type == CardUsageType.SKILL:
            if not game.harmony_area:
                logger.warning("归宅部：调和区为空时不可发动")
                return False
            if not hand_card_id or not harmony_card_id:
                logger.warning("归宅部特技需要指定手牌及调和区卡牌")
                return False
            if self._find_card_in_hand(player, hand_card_id) is None:
                logger.warning(f"归宅部：手牌中未找到 hand_card_id={hand_card_id}")
                return False
            if not any(c.id == harmony_card_id for c in game.harmony_area):
                logger.warning(f"归宅部：调和区未找到 harmony_card_id={harmony_card_id}")
                return False

        if usage_type == CardUsageType.SKILL:
            logger.info("执行特技出卡")
            return self._play_skill_card(player, card, target_player_id, target_card_id, hand_card_id, harmony_card_id)
        elif usage_type == CardUsageType.HARMONY:
            logger.info("执行调和出卡")
            return self._play_harmony_card(player, card)
        elif usage_type == CardUsageType.DOUBT:
            logger.info("执行质疑出卡")
            return self._play_doubt_card(player, card, target_player_id)
        else:
            logger.error(f"未知的出卡方式: usage_type={usage_type}")
            return False

    def _play_skill_card(
        self,
        player: Player,
        card: Card,
        target_player_id: Optional[str],
        target_card_id: Optional[str] = None,
        hand_card_id: Optional[str] = None,
        harmony_card_id: Optional[str] = None,
    ) -> bool:
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

        self._execute_card_effect(player, card, target_player_id, target_card_id, hand_card_id, harmony_card_id)
        if card.name != CardType.NEWS_CLUB:
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

    def _execute_card_effect(
        self,
        player: Player,
        card: Card,
        target_player_id: Optional[str],
        target_card_id: Optional[str] = None,
        hand_card_id: Optional[str] = None,
        harmony_card_id: Optional[str] = None,
    ):
        logger.info(f"执行卡牌效果: {card.name}, target_player_id={target_player_id}, target_card_id={target_card_id}, hand_card_id={hand_card_id}, harmony_card_id={harmony_card_id}")
        if card.name == CardType.CLASS_REP:
            self._effect_class_rep(player, target_player_id)
        elif card.name == CardType.LIBRARY_COMMITTEE:
            self._effect_library_committee(player)
        elif card.name == CardType.HEALTH_COMMITTEE:
            self._effect_health_committee(player, target_player_id, target_card_id)
        elif card.name == CardType.DISCIPLINE_COMMITTEE:
            self._effect_discipline_committee(player, target_player_id)
        elif card.name == CardType.NEWS_CLUB:
            self._effect_news_club()
        elif card.name == CardType.RICH_GIRL:
            self._effect_rich_girl(player, target_player_id)
        elif card.name == CardType.ACCOMPLICE:
            self._effect_accomplice(player, target_player_id)
        elif card.name == CardType.HOME_CLUB:
            self._effect_home_club(player, hand_card_id, harmony_card_id)
        else:
            logger.warning(f"卡牌效果未实现: {card.name}")

    def _effect_class_rep(self, player: Player, target_player_id: str, my_card_id: Optional[str] = None, target_card_id: Optional[str] = None):
        """班长：两人各自选定一张手牌进行交换。若指定了 my_card_id 与 target_card_id 则交换这两张。"""
        logger.info(f"执行班长效果: target_player_id={target_player_id}, my_card_id={my_card_id}, target_card_id={target_card_id}")
        target_player = self._get_player(target_player_id)
        if not target_player:
            logger.warning(f"目标玩家不存在: target_player_id={target_player_id}")
            return
        if not my_card_id or not target_card_id:
            logger.warning("班长效果需要双方选牌")
            return
        card_a = self._find_and_remove_card(player.hand, my_card_id)
        card_b = self._find_and_remove_card(target_player.hand, target_card_id)
        if not card_a or not card_b:
            if card_a:
                player.hand.append(card_a)
            if card_b:
                target_player.hand.append(card_b)
            logger.warning("班长：选牌不在手牌中")
            return
        player.hand.append(card_b)
        target_player.hand.append(card_a)
        player.current_hand_count = len(player.hand)
        target_player.current_hand_count = len(target_player.hand)
        logger.info(f"班长交换完成: {player.name} 与 {target_player.name} 各换一张")

    def execute_class_rep_skill(
        self, player_id: str, card_id: str, target_player_id: str, my_card_id: str, target_card_id: str
    ) -> bool:
        """班长两阶段：先选目标，再双方各选一张手牌交换。"""
        game = self.game_manager.game
        if not game or game.state != GameState.PLAYING:
            return False
        player = self._get_player(player_id)
        target_player = self._get_player(target_player_id)
        if not player or not target_player:
            return False
        card = self._find_card_in_hand(player, card_id)
        if not card or card.name != CardType.CLASS_REP:
            return False
        if self._find_card_in_hand(player, my_card_id) is None or self._find_card_in_hand(target_player, target_card_id) is None:
            return False
        player.hand = [c for c in player.hand if c.id != card.id]
        player.current_hand_count = len(player.hand)
        card.is_face_up = True
        card.location = "field"
        player.field_cards.append(card)
        self._effect_class_rep(player, target_player_id, my_card_id=my_card_id, target_card_id=target_card_id)
        self.game_manager.next_turn()
        logger.info("班长特技执行成功")
        return True

    def _effect_library_committee(self, player: Player):
        logger.info(f"执行图书委员效果: player={player.name}")
        pass

    def _effect_health_committee(
        self, player: Player, target_player_id: str, target_card_id: Optional[str] = None
    ):
        """保健委员：选择一张已被正面打出的卡牌，将它归入自己的手牌。"""
        logger.info(f"执行保健委员效果: player={player.name}, target_player_id={target_player_id}, target_card_id={target_card_id}")
        target_player = self._get_player(target_player_id)
        if not target_player or not target_player.field_cards:
            logger.warning(f"目标玩家不存在或无场牌: target_player_id={target_player_id}")
            return

        if target_card_id:
            card = self._find_and_remove_field_card(target_player.field_cards, target_card_id)
            if not card:
                logger.warning(f"目标场牌中未找到: target_card_id={target_card_id}")
                return
        else:
            card = target_player.field_cards.pop(0)
        card.location = "hand"
        player.hand.append(card)
        player.current_hand_count = len(player.hand)
        target_player.current_hand_count = len(target_player.hand)
        logger.info(f"保健委员效果完成: 将 {card.name} 归入手牌")

    def _effect_discipline_committee(self, player: Player, target_player_id: str):
        """风纪委员：仅查看一名玩家的所有手牌，不移动牌。由服务端单独下发 view_hand 给该玩家。"""
        logger.info(f"执行风纪委员效果（仅查看）: player={player.name}, target_player_id={target_player_id}")
        pass

    def _effect_news_club(self):
        """新闻部：每人选择一张手牌递给下家，由服务端多轮下发选牌请求后执行。此处不移动牌。"""
        logger.info("执行新闻部效果（选牌由服务端多轮收集）")

    def _effect_rich_girl(self, player: Player, target_player_id: str, take_card_id: Optional[str] = None, give_card_id: Optional[str] = None):
        """大小姐：从目标手牌拿一张（take_card_id），从自己手牌给目标一张（give_card_id）。若未指定则沿用旧逻辑取第一张。"""
        logger.info(f"执行大小姐效果: player={player.name}, target_player_id={target_player_id}, take={take_card_id}, give={give_card_id}")
        target_player = self._get_player(target_player_id)
        if not target_player or not target_player.hand:
            logger.warning(f"目标玩家不存在或无手牌: target_player_id={target_player_id}")
            return

        if take_card_id and give_card_id:
            card_from_target = self._find_and_remove_card(target_player.hand, take_card_id)
            if not card_from_target:
                logger.warning(f"目标手牌中未找到 take_card_id={take_card_id}")
                return
            player.hand.append(card_from_target)

            card_to_target = self._find_and_remove_card(player.hand, give_card_id)
            if not card_to_target:
                logger.warning(f"自己手牌中未找到 give_card_id={give_card_id}")
                target_player.hand.append(card_from_target)
                player.hand.remove(card_from_target)
                return
            target_player.hand.append(card_to_target)
        else:
            card_from_target = target_player.hand.pop(0)
            player.hand.append(card_from_target)
            if player.hand:
                card_to_target = player.hand.pop(0)
                target_player.hand.append(card_to_target)

        player.current_hand_count = len(player.hand)
        target_player.current_hand_count = len(target_player.hand)
        logger.info(f"大小姐效果完成: player={player.current_hand_count}, target={target_player.current_hand_count}")

    def _find_and_remove_card(self, hand: list, card_id: str) -> Optional[Card]:
        for i, c in enumerate(hand):
            if c.id == card_id:
                return hand.pop(i)
        return None

    def _find_and_remove_field_card(self, field_cards: list, card_id: str) -> Optional[Card]:
        for i, c in enumerate(field_cards):
            if c.id == card_id:
                return field_cards.pop(i)
        return None

    def execute_rich_girl_skill(
        self,
        player_id: str,
        card_id: str,
        target_player_id: str,
        take_card_id: str,
        give_card_id: str,
    ) -> bool:
        """大小姐两阶段：先选人，再选牌。执行出牌并指定拿/还的牌。"""
        game = self.game_manager.game
        if not game or game.state != GameState.PLAYING:
            return False
        player = self._get_player(player_id)
        target_player = self._get_player(target_player_id)
        if not player or not target_player:
            return False
        card = self._find_card_in_hand(player, card_id)
        if not card or card.name != CardType.RICH_GIRL:
            return False
        if self._find_card_in_hand(target_player, take_card_id) is None:
            return False
        if self._find_card_in_hand(player, give_card_id) is None:
            return False

        player.hand = [c for c in player.hand if c.id != card.id]
        player.current_hand_count = len(player.hand)
        card.is_face_up = True
        card.location = "field"
        player.field_cards.append(card)

        self._effect_rich_girl(player, target_player_id, take_card_id=take_card_id, give_card_id=give_card_id)
        self.game_manager.next_turn()
        logger.info("大小姐特技（选牌）执行成功")
        return True

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

    def _find_and_remove_harmony_card(self, harmony_area: list, card_id: str) -> Optional[Card]:
        for i, c in enumerate(harmony_area):
            if c.id == card_id:
                return harmony_area.pop(i)
        return None

    def _effect_home_club(self, player: Player, hand_card_id: Optional[str], harmony_card_id: Optional[str]):
        """归宅部：选择一张自己的手牌，和调和区的一张卡牌进行替换。"""
        logger.info(f"执行归宅部效果: player={player.name}, hand_card_id={hand_card_id}, harmony_card_id={harmony_card_id}")
        game = self.game_manager.game
        if not game or not game.harmony_area:
            logger.warning(f"游戏不存在或无调和区: game={game}, harmony_area_count={len(game.harmony_area) if game else 0}")
            return
        if not player.hand:
            logger.warning(f"玩家无手牌: player={player.name}")
            return
        if not hand_card_id or not harmony_card_id:
            return

        hand_card = self._find_and_remove_card(player.hand, hand_card_id)
        if not hand_card:
            logger.warning(f"归宅部：手牌中未找到 hand_card_id={hand_card_id}")
            return
        harmony_card = self._find_and_remove_harmony_card(game.harmony_area, harmony_card_id)
        if not harmony_card:
            logger.warning(f"归宅部：调和区未找到 harmony_card_id={harmony_card_id}")
            player.hand.append(hand_card)
            return

        hand_card.location = "harmony"
        game.harmony_area.append(hand_card)
        harmony_card.location = "hand"
        player.hand.append(harmony_card)
        player.current_hand_count = len(player.hand)
        logger.info(f"归宅部效果完成: 手牌 {hand_card.name} <-> 调和区 {harmony_card.name}")

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

    def apply_news_club_pass(self, from_player_id: str, to_player_id: str, card_id: str) -> bool:
        """新闻部：将 from 玩家手牌中的一张牌移到 to 玩家手牌。"""
        from_p = self._get_player(from_player_id)
        to_p = self._get_player(to_player_id)
        if not from_p or not to_p:
            return False
        card = self._find_and_remove_card(from_p.hand, card_id)
        if not card:
            return False
        to_p.hand.append(card)
        from_p.current_hand_count = len(from_p.hand)
        to_p.current_hand_count = len(to_p.hand)
        logger.info(f"新闻部传牌: {from_p.name} -> {to_p.name} 牌 {card.name}")
        return True
