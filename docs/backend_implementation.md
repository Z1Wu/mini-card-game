# 后端实现方案

## 项目结构

```
card_game_dev/
├── backend/
│   ├── main.py                 # 主程序入口
│   ├── requirements.txt        # 依赖管理
│   ├── config.py              # 配置文件
│   ├── game/
│   │   ├── __init__.py
│   │   ├── models.py          # 数据模型
│   │   ├── state.py           # 游戏状态管理
│   │   ├── cards.py           # 卡牌系统
│   │   ├── rules.py           # 游戏规则
│   │   └── victory.py         # 胜利条件判定
│   ├── websocket/
│   │   ├── __init__.py
│   │   ├── server.py          # WebSocket 服务器
│   │   └── handler.py         # 消息处理器
│   └── utils/
│       ├── __init__.py
│       └── helpers.py         # 工具函数
└── docs/
    └── backend_implementation.md
```

## 依赖管理

### requirements.txt

```
websockets>=12.0
asyncio>=3.4.3
pydantic>=2.0.0
python-dotenv>=1.0.0
```

## 数据模型设计

### 1. 卡牌模型 (game/models.py)

```python
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel

class CardType(str, Enum):
    CLASS_REP = "班长"
    LIBRARY_COMMITTEE = "图书委员"
    ALIEN = "外星人"
    HOME_CLUB = "归宅部"
    HEALTH_COMMITTEE = "保健委员"
    DISCIPLINE_COMMITTEE = "风纪委员"
    NEWS_CLUB = "新闻部"
    RICH_GIRL = "大小姐"
    ACCOMPLICE = "共犯"
    INFECTED = "感染者"
    CRIMINAL = "犯人"
    STUDENT_COUNCIL_PRESIDENT = "学生会长"
    HONOR_STUDENT = "优等生"

class CardUsageType(str, Enum):
    SKILL = "特技"
    HARMONY = "调和"
    DOUBT = "质疑"

class Card(BaseModel):
    id: str
    name: CardType
    description: str
    harmony_value: int
    victory_priority: int
    victory_condition: str
    owner_id: Optional[str] = None
    is_face_up: bool = False
    location: str = "hand"  # hand, harmony, doubt, field
    target_player_id: Optional[str] = None
```

### 2. 玩家模型 (game/models.py)

```python
class Player(BaseModel):
    id: str
    name: str
    hand: List[Card] = []
    field_cards: List[Card] = []
    doubt_cards: List[Card] = []
    is_connected: bool = True
    current_hand_count: int = 0
```

### 3. 游戏状态 (game/models.py)

```python
class GameState(str, Enum):
    WAITING = "waiting"
    PLAYING = "playing"
    SPECIAL_PHASE = "special_phase"
    GAME_OVER = "game_over"

class Game(BaseModel):
    id: str
    state: GameState = GameState.WAITING
    players: List[Player] = []
    harmony_area: List[Card] = []
    current_player_index: int = 0
    turn_count: int = 0
    player_count: int = 0
    required_harmony_value: int = 0
    winner: Optional[str] = None
```

## 卡牌库定义 (game/cards.py)

```python
CARD_DATABASE = {
    CardType.CLASS_REP: {
        "description": "选定一个玩家，两个人各自选定一张手牌进行交换。",
        "harmony_value": 2,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 2
    },
    CardType.LIBRARY_COMMITTEE: {
        "description": "你可以查看放在调和区的所有卡牌。",
        "harmony_value": 1,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 2
    },
    CardType.ALIEN: {
        "description": "当你持有这张牌时，若有人使用了优等生的特技，你可以假装是犯人来回应他。该牌正面打出的时候没有任何特殊效果。",
        "harmony_value": -1,
        "victory_priority": 1,
        "victory_condition": "1 被监禁即可获胜",
        "count": 1
    },
    CardType.HOME_CLUB: {
        "description": "选择一张自己的手牌，和调和区的一个卡牌进行替换。",
        "harmony_value": 0,
        "victory_priority": 5,
        "victory_condition": "5 没有任何人获胜即可获胜",
        "count": 3
    },
    CardType.HEALTH_COMMITTEE: {
        "description": "选择一张已经被正面打出的卡牌，将它归入自己的手牌。",
        "harmony_value": 2,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 2
    },
    CardType.DISCIPLINE_COMMITTEE: {
        "description": "你可以查看一名玩家的所有手牌。",
        "harmony_value": 2,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 2
    },
    CardType.NEWS_CLUB: {
        "description": "每个玩家选择自己的一张手牌，递给下一个玩家。",
        "harmony_value": 1,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 3
    },
    CardType.RICH_GIRL: {
        "description": "选择一个玩家，将他的手牌中的 1 张卡牌，放到自己的手牌中，然后选择一张自己的手牌给该玩家（可以是刚从该玩家收到的牌）。",
        "harmony_value": 1,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 3
    },
    CardType.ACCOMPLICE: {
        "description": "将一张放置再玩家面前的质疑位置的牌转移到任意一个其他玩家的质疑位置。（不可以是自己）",
        "harmony_value": 0,
        "victory_priority": 3,
        "victory_condition": "3 犯人获胜即可获胜",
        "count": 1
    },
    CardType.INFECTED: {
        "description": "在下一个回合开始时，若这张牌仍然正面朝上摆在你面前，则可以将调和区的一张牌加到自己手牌中。",
        "harmony_value": 0,
        "victory_priority": 2,
        "victory_condition": "2 调和失败即可获胜",
        "count": 1
    },
    CardType.CRIMINAL: {
        "description": "此卡片无法被正面朝上或者反面朝上打出，当时可以被其他卡片的效果移动。",
        "harmony_value": 0,
        "victory_priority": 3,
        "victory_condition": "3 不被监禁即可获胜",
        "count": 1
    },
    CardType.STUDENT_COUNCIL_PRESIDENT: {
        "description": "正面打出无效果。",
        "harmony_value": 3,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 1
    },
    CardType.HONOR_STUDENT: {
        "description": "正面打出该卡时，其他玩家闭上眼睛，同时持有犯人卡的玩家需要举手示意。",
        "harmony_value": 2,
        "victory_priority": 4,
        "victory_condition": "3 不被监禁即可获胜",
        "count": 2
    }
}

def create_card_deck() -> List[Card]:
    """创建完整的卡牌库"""
    deck = []
    for i, (card_type, card_data) in enumerate(CARD_DATABASE.items()):
        for j in range(card_data["count"]):
            card = Card(
                id=f"{card_type.value}_{j}",
                name=card_type,
                description=card_data["description"],
                harmony_value=card_data["harmony_value"],
                victory_priority=card_data["victory_priority"],
                victory_condition=card_data["victory_condition"]
            )
            deck.append(card)
    return deck
```

## 游戏状态管理 (game/state.py)

```python
import random
from typing import List, Optional
from .models import Game, Player, Card, GameState

class GameManager:
    def __init__(self):
        self.game: Optional[Game] = None

    def create_game(self, game_id: str) -> Game:
        """创建新游戏"""
        self.game = Game(id=game_id)
        return self.game

    def add_player(self, player_id: str, player_name: str) -> bool:
        """添加玩家"""
        if not self.game:
            return False
        if len(self.game.players) >= 6:
            return False

        player = Player(id=player_id, name=player_name)
        self.game.players.append(player)
        self.game.player_count = len(self.game.players)
        return True

    def remove_player(self, player_id: str) -> bool:
        """移除玩家"""
        if not self.game:
            return False

        self.game.players = [p for p in self.game.players if p.id != player_id]
        self.game.player_count = len(self.game.players)
        return True

    def deal_cards(self) -> bool:
        """发牌"""
        if not self.game or self.game.state != GameState.WAITING:
            return False

        # 根据人数确定手牌数量
        hand_count_map = {3: 6, 4: 6, 5: 5, 6: 4}
        hand_count = hand_count_map.get(self.game.player_count, 6)

        # 创建并洗牌
        from .cards import create_card_deck
        deck = create_card_deck()
        random.shuffle(deck)

        # 发牌
        for player in self.game.players:
            player.hand = deck[:hand_count]
            deck = deck[hand_count:]
            player.current_hand_count = len(player.hand)

        # 确定先手玩家（持有学生会长的玩家）
        self._set_first_player()

        # 设置调和目标值
        self._set_required_harmony_value()

        # 开始游戏
        self.game.state = GameState.PLAYING
        return True

    def _set_first_player(self):
        """设置先手玩家（持有学生会长的玩家）"""
        for i, player in enumerate(self.game.players):
            for card in player.hand:
                if card.name == CardType.STUDENT_COUNCIL_PRESIDENT:
                    self.game.current_player_index = i
                    return

    def _set_required_harmony_value(self):
        """设置调和目标值"""
        # 根据玩家数量计算调和目标值
        # 这里简化处理，实际需要根据规则计算
        self.game.required_harmony_value = self.game.player_count + 1

    def get_current_player(self) -> Optional[Player]:
        """获取当前玩家"""
        if not self.game:
            return None
        return self.game.players[self.game.current_player_index]

    def next_turn(self) -> bool:
        """下一回合"""
        if not self.game or self.game.state != GameState.PLAYING:
            return False

        self.game.current_player_index = (self.game.current_player_index + 1) % self.game.player_count
        self.game.turn_count += 1

        # 检查是否所有玩家只剩一张手牌
        if self._check_game_end_condition():
            self.game.state = GameState.GAME_OVER

        return True

    def _check_game_end_condition(self) -> bool:
        """检查游戏是否结束"""
        for player in self.game.players:
            if len(player.hand) > 1:
                return False
        return True
```

## 游戏规则实现 (game/rules.py)

```python
from typing import Optional, List
from .models import Card, CardUsageType, Player, Game, GameState

class GameRules:
    def __init__(self, game_manager):
        self.game_manager = game_manager

    def play_card(self, player_id: str, card_id: str, usage_type: CardUsageType, target_player_id: Optional[str] = None) -> bool:
        """出卡"""
        game = self.game_manager.game
        if not game or game.state != GameState.PLAYING:
            return False

        player = self._get_player(player_id)
        if not player:
            return False

        # 检查是否是当前玩家
        current_player = game.players[game.current_player_index]
        if player.id != current_player.id:
            return False

        # 查找卡牌
        card = self._find_card_in_hand(player, card_id)
        if not card:
            return False

        # 执行出卡逻辑
        if usage_type == CardUsageType.SKILL:
            return self._play_skill_card(player, card, target_player_id)
        elif usage_type == CardUsageType.HARMONY:
            return self._play_harmony_card(player, card)
        elif usage_type == CardUsageType.DOUBT:
            return self._play_doubt_card(player, card, target_player_id)

        return False

    def _play_skill_card(self, player: Player, card: Card, target_player_id: Optional[str]) -> bool:
        """使用特技"""
        game = self.game_manager.game

        # 特殊处理优等生特技
        if card.name == CardType.HONOR_STUDENT:
            return self._handle_honor_student_skill(player, card)

        # 特殊处理外星人响应
        if card.name == CardType.ALIEN:
            return self._handle_alien_skill(player, card)

        # 从手牌移除
        player.hand = [c for c in player.hand if c.id != card.id]
        player.current_hand_count = len(player.hand)

        # 添加到场上
        card.is_face_up = True
        card.location = "field"
        player.field_cards.append(card)

        # 执行卡牌效果
        self._execute_card_effect(player, card, target_player_id)

        # 下一回合
        self.game_manager.next_turn()
        return True

    def _play_harmony_card(self, player: Player, card: Card) -> bool:
        """调和"""
        game = self.game_manager.game

        # 从手牌移除
        player.hand = [c for c in player.hand if c.id != card.id]
        player.current_hand_count = len(player.hand)

        # 添加到调和区
        card.is_face_up = False
        card.location = "harmony"
        game.harmony_area.append(card)

        # 下一回合
        self.game_manager.next_turn()
        return True

    def _play_doubt_card(self, player: Player, card: Card, target_player_id: str) -> bool:
        """质疑"""
        game = self.game_manager.game

        # 检查目标玩家
        if target_player_id == player.id:
            return False

        target_player = self._get_player(target_player_id)
        if not target_player:
            return False

        # 从手牌移除
        player.hand = [c for c in player.hand if c.id != card.id]
        player.current_hand_count = len(player.hand)

        # 添加到目标玩家的质疑区
        card.is_face_up = False
        card.location = "doubt"
        card.target_player_id = target_player_id
        target_player.doubt_cards.append(card)

        # 下一回合
        self.game_manager.next_turn()
        return True

    def _handle_honor_student_skill(self, player: Player, card: Card) -> bool:
        """处理优等生特技"""
        game = self.game_manager.game

        # 从手牌移除
        player.hand = [c for c in player.hand if c.id != card.id]
        player.current_hand_count = len(player.hand)

        # 添加到场上
        card.is_face_up = True
        card.location = "field"
        player.field_cards.append(card)

        # 进入特殊阶段
        game.state = GameState.SPECIAL_PHASE

        # 广播消息，其他玩家需要闭眼
        # 持有犯人卡的玩家需要举手确认
        return True

    def _handle_alien_skill(self, player: Player, card: Card) -> bool:
        """处理外星人特技"""
        # 外星人正面打出无效果
        return self._play_skill_card(player, card, None)

    def _execute_card_effect(self, player: Player, card: Card, target_player_id: Optional[str]):
        """执行卡牌效果"""
        # 根据卡牌类型执行不同的效果
        if card.name == CardType.CLASS_REP:
            self._effect_class_rep(player, target_player_id)
        elif card.name == CardType.LIBRARY_COMMITTEE:
            self._effect_library_committee(player)
        elif card.name == CardType.HEALTH_COMMITTEE:
            self._effect_health_committee(player, target_player_id)
        # ... 其他卡牌效果

    def _effect_class_rep(self, player: Player, target_player_id: str):
        """班长效果：交换手牌"""
        target_player = self._get_player(target_player_id)
        if not target_player:
            return

        # 这里需要前端选择要交换的卡牌
        # 暂时简化处理，交换第一张手牌
        if player.hand and target_player.hand:
            player.hand[0], target_player.hand[0] = target_player.hand[0], player.hand[0]
            player.current_hand_count = len(player.hand)
            target_player.current_hand_count = len(target_player.hand)

    def _effect_library_committee(self, player: Player):
        """图书委员效果：查看调和区"""
        # 这个效果在前端实现，后端只需要提供调和区数据
        pass

    def _effect_health_committee(self, player: Player, target_player_id: str):
        """保健委员效果：收回场上的牌"""
        target_player = self._get_player(target_player_id)
        if not target_player or not target_player.field_cards:
            return

        # 这里需要前端选择要收回的卡牌
        # 暂时简化处理，收回第一张场上的牌
        card = target_player.field_cards.pop(0)
        card.location = "hand"
        player.hand.append(card)
        player.current_hand_count = len(player.hand)

    def _get_player(self, player_id: str) -> Optional[Player]:
        """获取玩家"""
        game = self.game_manager.game
        if not game:
            return None
        for player in game.players:
            if player.id == player_id:
                return player
        return None

    def _find_card_in_hand(self, player: Player, card_id: str) -> Optional[Card]:
        """在手牌中查找卡牌"""
        for card in player.hand:
            if card.id == card_id:
                return card
        return None
```

## 胜利条件判定 (game/victory.py)

```python
from typing import List, Optional
from .models import Game, Player, Card, CardType

class VictoryChecker:
    def __init__(self, game: Game):
        self.game = game

    def check_victory(self) -> Optional[str]:
        """检查胜利条件，返回获胜玩家ID"""
        # 判定1：调和值
        if self._check_harmony_victory():
            return self._get_harmony_winner()

        # 判定2：质疑结算
        imprisoned_player = self._check_doubt_settlement()
        if imprisoned_player:
            # 检查外星人是否获胜
            if self._check_alien_victory(imprisoned_player):
                return imprisoned_player

            # 检查犯人是否获胜
            if self._check_criminal_victory(imprisoned_player):
                return self._get_criminal_winner()

        # 判定3：胜利条件判定
        return self._check_all_victory_conditions()

    def _check_harmony_victory(self) -> bool:
        """检查调和值是否达标"""
        total_harmony = sum(card.harmony_value for card in self.game.harmony_area)
        return total_harmony >= self.game.required_harmony_value

    def _get_harmony_winner(self) -> Optional[str]:
        """获取调和胜利的玩家"""
        # 检查哪些玩家满足调和胜利条件
        winners = []
        for player in self.game.players:
            if self._player_meets_harmony_condition(player):
                winners.append(player.id)

        # 如果只有一个获胜者，返回该玩家
        if len(winners) == 1:
            return winners[0]

        # 如果有多个获胜者，按照优先级选择
        return self._select_winner_by_priority(winners)

    def _player_meets_harmony_condition(self, player: Player) -> bool:
        """检查玩家是否满足调和胜利条件"""
        # 检查玩家手牌中是否有满足调和条件的卡牌
        for card in player.hand:
            if card.victory_condition == "4 调和成功即可获胜":
                return True
        return False

    def _check_doubt_settlement(self) -> Optional[Player]:
        """质疑结算，返回被监禁的玩家"""
        # 计算每个玩家质疑区的数值总和
        player_doubt_values = {}
        for player in self.game.players:
            total_value = sum(card.harmony_value for card in player.doubt_cards)
            player_doubt_values[player.id] = total_value

        # 找出数值最大的玩家
        max_value = max(player_doubt_values.values())
        max_players = [pid for pid, value in player_doubt_values.items() if value == max_value]

        # 如果只有一个最大值，返回该玩家
        if len(max_players) == 1:
            return self._get_player(max_players[0])

        return None

    def _check_alien_victory(self, imprisoned_player: Player) -> bool:
        """检查外星人是否获胜"""
        # 检查被监禁的玩家是否持有外星人卡
        for card in imprisoned_player.hand:
            if card.name == CardType.ALIEN:
                return True
        return False

    def _check_criminal_victory(self, imprisoned_player: Player) -> bool:
        """检查犯人是否获胜"""
        # 检查被监禁的玩家是否不是犯人
        for card in imprisoned_player.hand:
            if card.name == CardType.CRIMINAL:
                return False
        return True

    def _get_criminal_winner(self) -> Optional[str]:
        """获取犯人胜利的获胜者"""
        # 检查共犯是否获胜
        for player in self.game.players:
            for card in player.hand:
                if card.name == CardType.ACCOMPLICE:
                    return player.id
        return None

    def _check_all_victory_conditions(self) -> Optional[str]:
        """检查所有胜利条件"""
        # 按照胜利条件优先级依次检查
        players_by_priority = self._sort_players_by_victory_priority()

        for player in players_by_priority:
            if self._check_player_victory_condition(player):
                return player.id

        return None

    def _sort_players_by_victory_priority(self) -> List[Player]:
        """按照胜利条件优先级排序玩家"""
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
        """检查玩家是否满足胜利条件"""
        for card in player.hand:
            if self._check_card_victory_condition(card, player):
                return True
        return False

    def _check_card_victory_condition(self, card: Card, player: Player) -> bool:
        """检查卡牌的胜利条件"""
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
            return True  # 如果前面都没有人获胜，归宅部获胜

        return False

    def _is_player_imprisoned(self, player: Player) -> bool:
        """检查玩家是否被监禁"""
        # 玩家被监禁的条件是在质疑结算中数值最大
        # 这里简化处理，实际需要在质疑结算时标记
        return False

    def _get_player(self, player_id: str) -> Optional[Player]:
        """获取玩家"""
        for player in self.game.players:
            if player.id == player_id:
                return player
        return None
```

## WebSocket 服务器 (websocket/server.py)

```python
import asyncio
import json
import websockets
from typing import Set, Dict
from ..game.state import GameManager
from ..game.rules import GameRules
from ..game.victory import VictoryChecker

class GameWebSocketServer:
    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.player_connections: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.game_manager = GameManager()
        self.game_rules = GameRules(self.game_manager)

    async def register_client(self, websocket: websockets.WebSocketServerProtocol):
        """注册客户端"""
        self.clients.add(websocket)

    async def unregister_client(self, websocket: websockets.WebSocketServerProtocol):
        """注销客户端"""
        self.clients.discard(websocket)
        # 移除玩家连接
        player_id = self._get_player_id_by_websocket(websocket)
        if player_id:
            del self.player_connections[player_id]
            self.game_manager.remove_player(player_id)

    async def broadcast(self, message: dict):
        """广播消息给所有客户端"""
        if self.clients:
            await asyncio.gather(
                *[client.send(json.dumps(message)) for client in self.clients]
            )

    async def send_to_player(self, player_id: str, message: dict):
        """发送消息给指定玩家"""
        if player_id in self.player_connections:
            await self.player_connections[player_id].send(json.dumps(message))

    async def handle_message(self, websocket: websockets.WebSocketServerProtocol, message: dict):
        """处理客户端消息"""
        message_type = message.get("type")

        if message_type == "join_game":
            await self._handle_join_game(websocket, message)
        elif message_type == "play_card":
            await self._handle_play_card(websocket, message)
        elif message_type == "get_game_state":
            await self._handle_get_game_state(websocket)
        elif message_type == "honor_student_response":
            await self._handle_honor_student_response(websocket, message)

    async def _handle_join_game(self, websocket: websockets.WebSocketServerProtocol, message: dict):
        """处理加入游戏"""
        player_id = message.get("player_id")
        player_name = message.get("player_name")

        if not player_id or not player_name:
            await websocket.send(json.dumps({
                "type": "error",
                "message": "缺少玩家ID或玩家名称"
            }))
            return

        # 创建游戏（如果还没有）
        if not self.game_manager.game:
            self.game_manager.create_game("game_1")

        # 添加玩家
        if self.game_manager.add_player(player_id, player_name):
            self.player_connections[player_id] = websocket

            # 发送加入成功消息
            await websocket.send(json.dumps({
                "type": "join_success",
                "player_id": player_id,
                "player_name": player_name
            }))

            # 广播玩家列表更新
            await self._broadcast_player_list()
        else:
            await websocket.send(json.dumps({
                "type": "error",
                "message": "加入游戏失败"
            }))

    async def _handle_play_card(self, websocket: websockets.WebSocketServerProtocol, message: dict):
        """处理出卡"""
        player_id = message.get("player_id")
        card_id = message.get("card_id")
        usage_type = message.get("usage_type")
        target_player_id = message.get("target_player_id")

        if not player_id or not card_id or not usage_type:
            await websocket.send(json.dumps({
                "type": "error",
                "message": "缺少必要参数"
            }))
            return

        # 执行出卡
        success = self.game_rules.play_card(
            player_id,
            card_id,
            CardUsageType(usage_type),
            target_player_id
        )

        if success:
            # 广播游戏状态更新
            await self._broadcast_game_state()
        else:
            await websocket.send(json.dumps({
                "type": "error",
                "message": "出卡失败"
            }))

    async def _handle_get_game_state(self, websocket: websockets.WebSocketServerProtocol):
        """处理获取游戏状态"""
        await websocket.send(json.dumps({
            "type": "game_state",
            "game_state": self._serialize_game_state()
        }))

    async def _handle_honor_student_response(self, websocket: websockets.WebSocketServerProtocol, message: dict):
        """处理优等生特技响应"""
        player_id = message.get("player_id")
        response = message.get("response")  # "raise_hand" 或 "none"

        # 处理外星人响应
        if response == "raise_hand":
            # 玩家举手（可能是犯人或外星人）
            pass

        # 检查是否所有玩家都响应了
        # 如果都响应了，结束特殊阶段
        game = self.game_manager.game
        if game and game.state == GameState.SPECIAL_PHASE:
            game.state = GameState.PLAYING
            self.game_manager.next_turn()
            await self._broadcast_game_state()

    async def _broadcast_player_list(self):
        """广播玩家列表"""
        game = self.game_manager.game
        if not game:
            return

        player_list = [
            {
                "id": player.id,
                "name": player.name,
                "hand_count": player.current_hand_count
            }
            for player in game.players
        ]

        await self.broadcast({
            "type": "player_list",
            "players": player_list
        })

    async def _broadcast_game_state(self):
        """广播游戏状态"""
        await self.broadcast({
            "type": "game_state",
            "game_state": self._serialize_game_state()
        })

    def _serialize_game_state(self) -> dict:
        """序列化游戏状态"""
        game = self.game_manager.game
        if not game:
            return {}

        return {
            "game_id": game.id,
            "state": game.state.value,
            "players": [
                {
                    "id": player.id,
                    "name": player.name,
                    "hand_count": player.current_hand_count,
                    "field_cards_count": len(player.field_cards),
                    "doubt_cards_count": len(player.doubt_cards)
                }
                for player in game.players
            ],
            "current_player_index": game.current_player_index,
            "turn_count": game.turn_count,
            "harmony_area_count": len(game.harmony_area),
            "required_harmony_value": game.required_harmony_value
        }

    def _get_player_id_by_websocket(self, websocket: websockets.WebSocketServerProtocol) -> Optional[str]:
        """通过websocket获取玩家ID"""
        for player_id, ws in self.player_connections.items():
            if ws == websocket:
                return player_id
        return None

    async def start(self):
        """启动服务器"""
        async with websockets.serve(self._handle_client, self.host, self.port):
            print(f"WebSocket服务器启动在 {self.host}:{self.port}")
            await asyncio.Future()  # 永远运行

    async def _handle_client(self, websocket: websockets.WebSocketServerProtocol):
        """处理客户端连接"""
        await self.register_client(websocket)
        try:
            async for message in websocket:
                data = json.loads(message)
                await self.handle_message(websocket, data)
        finally:
            await self.unregister_client(websocket)
```

## 主程序入口 (main.py)

```python
import asyncio
from websocket.server import GameWebSocketServer

async def main():
    server = GameWebSocketServer(host="0.0.0.0", port=8765)
    await server.start()

if __name__ == "__main__":
    asyncio.run(main())
```

## 配置文件 (config.py)

```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # 服务器配置
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", 8765))

    # 游戏配置
    MAX_PLAYERS = 6
    MIN_PLAYERS = 3

    # WebSocket配置
    PING_INTERVAL = 20
    PING_TIMEOUT = 20
```

## WebSocket 消息协议

### 客户端 -> 服务器

```json
{
  "type": "join_game",
  "player_id": "player_1",
  "player_name": "玩家1"
}
```

```json
{
  "type": "play_card",
  "player_id": "player_1",
  "card_id": "班长_0",
  "usage_type": "skill",
  "target_player_id": "player_2"
}
```

```json
{
  "type": "get_game_state",
  "player_id": "player_1"
}
```

```json
{
  "type": "honor_student_response",
  "player_id": "player_1",
  "response": "raise_hand"
}
```

### 服务器 -> 客户端

```json
{
  "type": "join_success",
  "player_id": "player_1",
  "player_name": "玩家1"
}
```

```json
{
  "type": "player_list",
  "players": [
    {
      "id": "player_1",
      "name": "玩家1",
      "hand_count": 6
    }
  ]
}
```

```json
{
  "type": "game_state",
  "game_state": {
    "game_id": "game_1",
    "state": "playing",
    "players": [...],
    "current_player_index": 0,
    "turn_count": 1
  }
}
```

```json
{
  "type": "error",
  "message": "错误信息"
}
```

## 实施步骤

1. **创建项目结构**
   - 创建目录结构
   - 创建配置文件
   - 创建依赖管理文件

2. **实现数据模型**
   - 实现卡牌模型
   - 实现玩家模型
   - 实现游戏状态模型

3. **实现卡牌系统**
   - 实现卡牌库
   - 实现卡牌创建和洗牌

4. **实现游戏状态管理**
   - 实现游戏管理器
   - 实现玩家管理
   - 实现发牌逻辑
   - 实现回合管理

5. **实现游戏规则**
   - 实现出卡逻辑
   - 实现特技效果
   - 实现调和逻辑
   - 实现质疑逻辑
   - 实现特殊交互（优等生、外星人）

6. **实现胜利条件判定**
   - 实现调和值判定
   - 实现质疑结算
   - 实现各角色胜利条件

7. **实现 WebSocket 服务器**
   - 实现服务器基础功能
   - 实现消息处理
   - 实现广播机制
   - 实现特殊交互处理

8. **测试和调试**
   - 单元测试
   - 集成测试
   - 多人联调测试

## 注意事项

1. **异步编程**：使用 asyncio 处理并发
2. **状态管理**：确保游戏状态的一致性
3. **错误处理**：完善的错误处理机制
4. **消息验证**：验证客户端消息的合法性
5. **性能优化**：考虑大量玩家时的性能问题
