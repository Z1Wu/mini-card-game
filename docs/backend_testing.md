# 后端测试方案

## 测试方法概览

在没有前端的情况下，可以通过以下方式测试后端：

1. **WebSocket 测试客户端** - 使用 Python 编写模拟客户端
2. **单元测试** - 使用 pytest 测试各个模块
3. **集成测试** - 模拟多人游戏流程
4. **WebSocket 调试工具** - 使用 wscat 等工具手动测试

---

## 1. WebSocket 测试客户端

### 1.1 基础测试客户端

创建 `tests/test_client.py`：

```python
import asyncio
import json
import websockets

class GameTestClient:
    def __init__(self, uri: str = "ws://localhost:8765"):
        self.uri = uri
        self.websocket = None
        self.player_id = None
        self.player_name = None
        self.messages = []

    async def connect(self, player_id: str, player_name: str):
        """连接到游戏服务器"""
        self.player_id = player_id
        self.player_name = player_name

        self.websocket = await websockets.connect(self.uri)
        print(f"✓ {player_name} 已连接")

        # 发送加入游戏消息
        await self.send_message({
            "type": "join_game",
            "player_id": player_id,
            "player_name": player_name
        })

        # 接收响应
        response = await self.receive_message()
        print(f"  收到: {response}")

        return response

    async def send_message(self, message: dict):
        """发送消息"""
        if self.websocket:
            await self.websocket.send(json.dumps(message))
            print(f"  发送: {message}")

    async def receive_message(self) -> dict:
        """接收消息"""
        if self.websocket:
            message = await self.websocket.recv()
            data = json.loads(message)
            self.messages.append(data)
            return data
        return None

    async def play_card(self, card_id: str, usage_type: str, target_player_id: str = None):
        """出卡"""
        message = {
            "type": "play_card",
            "player_id": self.player_id,
            "card_id": card_id,
            "usage_type": usage_type
        }
        if target_player_id:
            message["target_player_id"] = target_player_id

        await self.send_message(message)
        response = await self.receive_message()
        print(f"  收到: {response}")
        return response

    async def get_game_state(self):
        """获取游戏状态"""
        await self.send_message({
            "type": "get_game_state",
            "player_id": self.player_id
        })
        return await self.receive_message()

    async def respond_honor_student(self, response: str):
        """响应优等生特技"""
        await self.send_message({
            "type": "honor_student_response",
            "player_id": self.player_id,
            "response": response
        })
        return await self.receive_message()

    async def close(self):
        """关闭连接"""
        if self.websocket:
            await self.websocket.close()
            print(f"✓ {self.player_name} 已断开连接")

    async def listen(self):
        """监听消息"""
        try:
            async for message in self.websocket:
                data = json.loads(message)
                self.messages.append(data)
                print(f"  {self.player_name} 收到: {data}")
        except websockets.exceptions.ConnectionClosed:
            print(f"✗ {self.player_name} 连接已关闭")
```

### 1.2 测试脚本

创建 `tests/test_game_flow.py`：

```python
import asyncio
from test_client import GameTestClient

async def test_basic_flow():
    """测试基本游戏流程"""
    print("\n=== 测试基本游戏流程 ===\n")

    # 创建3个测试客户端
    client1 = GameTestClient()
    client2 = GameTestClient()
    client3 = GameTestClient()

    try:
        # 1. 玩家加入游戏
        print("1. 玩家加入游戏")
        await client1.connect("player_1", "玩家1")
        await client2.connect("player_2", "玩家2")
        await client3.connect("player_3", "玩家3")

        # 等待一下，让所有玩家都加入
        await asyncio.sleep(1)

        # 2. 获取游戏状态
        print("\n2. 获取游戏状态")
        state = await client1.get_game_state()
        print(f"  游戏状态: {state}")

        # 3. 玩家1出卡（调和）
        print("\n3. 玩家1出卡（调和）")
        await client1.play_card("班长_0", "harmony")

        # 4. 玩家2出卡（特技）
        print("\n4. 玩家2出卡（特技）")
        await client2.play_card("图书委员_0", "skill")

        # 5. 玩家3出卡（质疑）
        print("\n5. 玩家3出卡（质疑）")
        await client3.play_card("风纪委员_0", "doubt", "player_1")

        # 6. 获取最终游戏状态
        print("\n6. 获取最终游戏状态")
        state = await client1.get_game_state()
        print(f"  游戏状态: {state}")

    finally:
        # 关闭所有连接
        await client1.close()
        await client2.close()
        await client3.close()

async def test_honor_student_skill():
    """测试优等生特技"""
    print("\n=== 测试优等生特技 ===\n")

    client1 = GameTestClient()
    client2 = GameTestClient()
    client3 = GameTestClient()

    try:
        # 玩家加入游戏
        print("1. 玩家加入游戏")
        await client1.connect("player_1", "玩家1")
        await client2.connect("player_2", "玩家2")
        await client3.connect("player_3", "玩家3")

        await asyncio.sleep(1)

        # 玩家1使用优等生特技
        print("\n2. 玩家1使用优等生特技")
        await client1.play_card("优等生_0", "skill")

        # 其他玩家响应
        print("\n3. 其他玩家响应")
        await client2.respond_honor_student("none")
        await client3.respond_honor_student("raise_hand")

        # 获取游戏状态
        print("\n4. 获取游戏状态")
        state = await client1.get_game_state()
        print(f"  游戏状态: {state}")

    finally:
        await client1.close()
        await client2.close()
        await client3.close()

async def test_multiple_clients():
    """测试多个客户端同时连接"""
    print("\n=== 测试多个客户端同时连接 ===\n")

    clients = []
    for i in range(6):
        client = GameTestClient()
        await client.connect(f"player_{i+1}", f"玩家{i+1}")
        clients.append(client)

    await asyncio.sleep(1)

    # 获取游戏状态
    state = await clients[0].get_game_state()
    print(f"  游戏状态: {state}")

    # 关闭所有连接
    for client in clients:
        await client.close()

if __name__ == "__main__":
    # 运行测试
    asyncio.run(test_basic_flow())
    asyncio.run(test_honor_student_skill())
    asyncio.run(test_multiple_clients())
```

---

## 2. 单元测试

### 2.1 安装测试依赖

创建 `tests/requirements.txt`：

```
pytest>=7.0.0
pytest-asyncio>=0.21.0
pytest-cov>=4.0.0
```

### 2.2 单元测试示例

创建 `tests/test_game_state.py`：

```python
import pytest
from backend.game.state import GameManager
from backend.game.models import GameState, CardType

@pytest.fixture
def game_manager():
    """创建游戏管理器"""
    manager = GameManager()
    manager.create_game("test_game")
    return manager

def test_create_game(game_manager):
    """测试创建游戏"""
    assert game_manager.game is not None
    assert game_manager.game.id == "test_game"
    assert game_manager.game.state == GameState.WAITING

def test_add_player(game_manager):
    """测试添加玩家"""
    result = game_manager.add_player("player_1", "玩家1")
    assert result is True
    assert len(game_manager.game.players) == 1
    assert game_manager.game.players[0].id == "player_1"

def test_add_too_many_players(game_manager):
    """测试添加过多玩家"""
    # 添加6个玩家
    for i in range(6):
        game_manager.add_player(f"player_{i+1}", f"玩家{i+1}")

    # 尝试添加第7个玩家
    result = game_manager.add_player("player_7", "玩家7")
    assert result is False
    assert len(game_manager.game.players) == 6

def test_remove_player(game_manager):
    """测试移除玩家"""
    game_manager.add_player("player_1", "玩家1")
    game_manager.add_player("player_2", "玩家2")

    result = game_manager.remove_player("player_1")
    assert result is True
    assert len(game_manager.game.players) == 1
    assert game_manager.game.players[0].id == "player_2"

def test_deal_cards(game_manager):
    """测试发牌"""
    # 添加3个玩家
    for i in range(3):
        game_manager.add_player(f"player_{i+1}", f"玩家{i+1}")

    # 发牌
    result = game_manager.deal_cards()
    assert result is True

    # 检查每个玩家都有6张牌
    for player in game_manager.game.players:
        assert len(player.hand) == 6
        assert player.current_hand_count == 6

def test_next_turn(game_manager):
    """测试下一回合"""
    # 添加玩家
    for i in range(3):
        game_manager.add_player(f"player_{i+1}", f"玩家{i+1}")

    # 发牌
    game_manager.deal_cards()

    # 初始当前玩家索引是0
    assert game_manager.game.current_player_index == 0

    # 下一回合
    game_manager.next_turn()
    assert game_manager.game.current_player_index == 1

    # 再下一回合
    game_manager.next_turn()
    assert game_manager.game.current_player_index == 2

    # 再下一回合（回到第一个玩家）
    game_manager.next_turn()
    assert game_manager.game.current_player_index == 0

def test_get_current_player(game_manager):
    """测试获取当前玩家"""
    # 添加玩家
    for i in range(3):
        game_manager.add_player(f"player_{i+1}", f"玩家{i+1}")

    # 发牌
    game_manager.deal_cards()

    # 获取当前玩家
    current_player = game_manager.get_current_player()
    assert current_player is not None
    assert current_player.id == "player_1"
```

创建 `tests/test_cards.py`：

```python
import pytest
from backend.game.cards import create_card_deck, CARD_DATABASE
from backend.game.models import CardType

def test_create_card_deck():
    """测试创建卡牌库"""
    deck = create_card_deck()

    # 检查卡牌总数
    total_cards = sum(card_data["count"] for card_data in CARD_DATABASE.values())
    assert len(deck) == total_cards

    # 检查每种卡牌的数量
    card_counts = {}
    for card in deck:
        card_counts[card.name] = card_counts.get(card.name, 0) + 1

    for card_type, card_data in CARD_DATABASE.items():
        assert card_counts.get(card_type, 0) == card_data["count"]

def test_card_properties():
    """测试卡牌属性"""
    deck = create_card_deck()

    # 检查班长卡牌
    class_rep_cards = [card for card in deck if card.name == CardType.CLASS_REP]
    assert len(class_rep_cards) == 2

    card = class_rep_cards[0]
    assert card.cost == 2
    assert card.harmony_value == 2
    assert card.victory_priority == 4

    # 检查外星人卡牌
    alien_cards = [card for card in deck if card.name == CardType.ALIEN]
    assert len(alien_cards) == 1

    card = alien_cards[0]
    assert card.cost == -1
    assert card.harmony_value == 1
    assert card.victory_priority == 1

def test_card_database():
    """测试卡牌数据库"""
    # 检查所有卡牌类型都在数据库中
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
```

创建 `tests/test_victory.py`：

```python
import pytest
from backend.game.state import GameManager
from backend.game.victory import VictoryChecker
from backend.game.models import GameState, CardType

@pytest.fixture
def game_manager():
    """创建游戏管理器"""
    manager = GameManager()
    manager.create_game("test_game")
    return manager

@pytest.fixture
def victory_checker(game_manager):
    """创建胜利条件检查器"""
    return VictoryChecker(game_manager.game)

def test_victory_checker_initialization(victory_checker):
    """测试胜利条件检查器初始化"""
    assert victory_checker.game is not None

def test_check_harmony_victory(victory_checker):
    """测试调和胜利检查"""
    # 添加调和卡牌
    from backend.game.models import Card

    for i in range(5):
        card = Card(
            id=f"card_{i}",
            name=CardType.CLASS_REP,
            cost=2,
            description="测试卡牌",
            harmony_value=2,
            victory_priority=4,
            victory_condition="4 调和成功即可获胜"
        )
        victory_checker.game.harmony_area.append(card)

    # 检查调和胜利
    result = victory_checker._check_harmony_victory()
    assert result is True
```

### 2.3 运行单元测试

```bash
# 安装测试依赖
pip install -r tests/requirements.txt

# 运行所有测试
pytest tests/

# 运行特定测试文件
pytest tests/test_game_state.py

# 运行测试并显示输出
pytest tests/ -v

# 运行测试并生成覆盖率报告
pytest tests/ --cov=backend --cov-report=html
```

---

## 3. 集成测试

创建 `tests/test_integration.py`：

```python
import asyncio
import pytest
from test_client import GameTestClient

@pytest.mark.asyncio
async def test_full_game_flow():
    """测试完整游戏流程"""
    print("\n=== 测试完整游戏流程 ===\n")

    # 创建4个测试客户端
    clients = []
    for i in range(4):
        client = GameTestClient()
        await client.connect(f"player_{i+1}", f"玩家{i+1}")
        clients.append(client)

    await asyncio.sleep(1)

    try:
        # 模拟游戏进行
        for turn in range(10):
            current_client = clients[turn % 4]
            print(f"\n回合 {turn + 1}: {current_client.player_name}")

            # 简单的出卡逻辑
            if turn % 3 == 0:
                await current_client.play_card("班长_0", "harmony")
            elif turn % 3 == 1:
                await current_client.play_card("图书委员_0", "skill")
            else:
                target_id = f"player_{(turn + 1) % 4 + 1}"
                await current_client.play_card("风纪委员_0", "doubt", target_id)

            # 获取游戏状态
            state = await clients[0].get_game_state()
            print(f"  当前回合: {state['game_state']['current_player_index']}")

            await asyncio.sleep(0.5)

    finally:
        # 关闭所有连接
        for client in clients:
            await client.close()

@pytest.mark.asyncio
async def test_special_interactions():
    """测试特殊交互"""
    print("\n=== 测试特殊交互 ===\n")

    client1 = GameTestClient()
    client2 = GameTestClient()
    client3 = GameTestClient()

    try:
        # 玩家加入游戏
        await client1.connect("player_1", "玩家1")
        await client2.connect("player_2", "玩家2")
        await client3.connect("player_3", "玩家3")

        await asyncio.sleep(1)

        # 测试优等生特技
        print("\n测试优等生特技")
        await client1.play_card("优等生_0", "skill")
        await client2.respond_honor_student("none")
        await client3.respond_honor_student("raise_hand")

        await asyncio.sleep(1)

        # 测试外星人响应
        print("\n测试外星人响应")
        await client1.play_card("优等生_1", "skill")
        await client2.respond_honor_student("raise_hand")  # 外星人假装犯人
        await client3.respond_honor_student("none")

    finally:
        await client1.close()
        await client2.close()
        await client3.close()
```

---

## 4. WebSocket 调试工具

### 4.1 使用 wscat

安装 wscat：

```bash
npm install -g wscat
```

连接到服务器：

```bash
wscat -c ws://localhost:8765
```

发送消息：

```json
{"type": "join_game", "player_id": "test_1", "player_name": "测试玩家1"}
```

```json
{"type": "get_game_state", "player_id": "test_1"}
```

```json
{"type": "play_card", "player_id": "test_1", "card_id": "班长_0", "usage_type": "harmony"}
```

### 4.2 使用 Postman

1. 创建新的 WebSocket 请求
2. 输入服务器地址：`ws://localhost:8765`
3. 发送 JSON 消息

### 4.3 使用浏览器控制台

在浏览器控制台中：

```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
    console.log('已连接');
    ws.send(JSON.stringify({
        type: 'join_game',
        player_id: 'browser_test',
        player_name: '浏览器测试'
    }));
};

ws.onmessage = (event) => {
    console.log('收到消息:', JSON.parse(event.data));
};

ws.onerror = (error) => {
    console.error('错误:', error);
};
```

---

## 5. 测试运行脚本

创建 `tests/run_tests.sh`：

```bash
#!/bin/bash

echo "=== 运行后端测试 ==="

# 1. 启动后端服务器
echo "1. 启动后端服务器..."
python backend/main.py &
SERVER_PID=$!
echo "服务器 PID: $SERVER_PID"

# 等待服务器启动
sleep 3

# 2. 运行单元测试
echo "2. 运行单元测试..."
pytest tests/ -v

# 3. 运行集成测试
echo "3. 运行集成测试..."
pytest tests/test_integration.py -v

# 4. 关闭服务器
echo "4. 关闭服务器..."
kill $SERVER_PID

echo "=== 测试完成 ==="
```

创建 `tests/run_manual_test.py`：

```python
import asyncio
from test_client import GameTestClient

async def manual_test():
    """手动测试"""
    print("=== 手动测试模式 ===")
    print("输入 'help' 查看可用命令\n")

    clients = {}

    while True:
        command = input(">>> ").strip()

        if command == "help":
            print("""
可用命令:
  connect <id> <name>  - 连接服务器
  play <id> <card> <type> [target]  - 出卡
  state <id>  - 获取游戏状态
  close <id>  - 断开连接
  quit  - 退出
            """)
        elif command.startswith("connect"):
            _, player_id, player_name = command.split()
            client = GameTestClient()
            await client.connect(player_id, player_name)
            clients[player_id] = client
        elif command.startswith("play"):
            parts = command.split()
            player_id = parts[1]
            card_id = parts[2]
            usage_type = parts[3]
            target_id = parts[4] if len(parts) > 4 else None
            await clients[player_id].play_card(card_id, usage_type, target_id)
        elif command.startswith("state"):
            _, player_id = command.split()
            state = await clients[player_id].get_game_state()
            print(f"游戏状态: {state}")
        elif command.startswith("close"):
            _, player_id = command.split()
            await clients[player_id].close()
            del clients[player_id]
        elif command == "quit":
            for client in clients.values():
                await client.close()
            break

if __name__ == "__main__":
    asyncio.run(manual_test())
```

---

## 6. 测试建议

### 6.1 测试顺序

1. **单元测试** - 先测试各个模块的功能
2. **集成测试** - 测试模块之间的交互
3. **端到端测试** - 测试完整的游戏流程
4. **手动测试** - 使用调试工具进行探索性测试

### 6.2 测试覆盖

确保测试覆盖以下场景：
- ✅ 玩家加入/离开
- ✅ 发牌逻辑
- ✅ 三种出卡方式（特技、调和、质疑）
- ✅ 回合管理
- ✅ 特殊交互（优等生、外星人）
- ✅ 胜利条件判定
- ✅ 错误处理

### 6.3 持续集成

可以设置 GitHub Actions 或其他 CI 工具自动运行测试：

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r tests/requirements.txt
      - name: Run tests
        run: pytest tests/ -v
```

---

## 总结

通过以上测试方法，可以在没有前端的情况下全面测试后端功能：

1. **WebSocket 测试客户端** - 模拟真实的前端行为
2. **单元测试** - 测试各个模块的功能
3. **集成测试** - 测试完整的游戏流程
4. **WebSocket 调试工具** - 手动测试和调试

建议先运行单元测试确保各个模块正常，然后使用测试客户端进行集成测试，最后使用调试工具进行手动测试。
