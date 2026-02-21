# 卡牌游戏后端

## 项目结构

```
backend/
├── main.py                 # 主程序入口
├── config.py              # 配置文件
├── requirements.txt        # 依赖管理
├── game/
│   ├── models.py          # 数据模型
│   ├── state.py           # 游戏状态管理
│   ├── cards.py           # 卡牌系统
│   ├── rules.py           # 游戏规则
│   └── victory.py         # 胜利条件判定
└── websocket/
    └── server.py          # WebSocket 服务器
```

## 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

## 运行后端服务器

```bash
cd backend
python main.py
```

服务器将在 `ws://localhost:8765` 启动。

## 运行测试

### 安装测试依赖

```bash
cd tests
pip install -r requirements.txt
```

### 运行单元测试

```bash
cd tests
pytest test_game_state.py -v
pytest test_cards.py -v
```

### 运行集成测试

首先启动后端服务器：

```bash
cd backend
python main.py
```

然后在另一个终端运行测试：

```bash
cd tests
python test_game_flow.py
```

## WebSocket 消息协议

### 客户端 -> 服务器

#### 加入游戏
```json
{
  "type": "join_game",
  "player_id": "player_1",
  "player_name": "玩家1"
}
```

#### 开始游戏
```json
{
  "type": "start_game",
  "player_id": "player_1"
}
```

#### 出卡
```json
{
  "type": "play_card",
  "player_id": "player_1",
  "card_id": "班长_0",
  "usage_type": "skill",
  "target_player_id": "player_2"
}
```

#### 获取游戏状态
```json
{
  "type": "get_game_state",
  "player_id": "player_1"
}
```

#### 响应优等生特技
```json
{
  "type": "honor_student_response",
  "player_id": "player_1",
  "response": "raise_hand"
}
```

### 服务器 -> 客户端

#### 加入成功
```json
{
  "type": "join_success",
  "player_id": "player_1",
  "player_name": "玩家1"
}
```

#### 玩家列表
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

#### 游戏状态
```json
{
  "type": "game_state",
  "game_state": {
    "game_id": "game_1",
    "state": "playing",
    "players": [...],
    "current_player_index": 0,
    "turn_count": 1,
    "harmony_area_count": 1,
    "required_harmony_value": 6
  }
}
```

#### 错误消息
```json
{
  "type": "error",
  "message": "错误信息"
}
```

## 卡牌类型

- 班长 (CLASS_REP)
- 图书委员 (LIBRARY_COMMITTEE)
- 外星人 (ALIEN)
- 归宅部 (HOME_CLUB)
- 保健委员 (HEALTH_COMMITTEE)
- 风纪委员 (DISCIPLINE_COMMITTEE)
- 新闻部 (NEWS_CLUB)
- 大小姐 (RICH_GIRL)
- 共犯 (ACCOMPLICE)
- 感染者 (INFECTED)
- 犯人 (CRIMINAL)
- 学生会长 (STUDENT_COUNCIL_PRESIDENT)
- 优等生 (HONOR_STUDENT)

## 出卡方式

- 特技 (SKILL) - 将卡牌正面朝上放置在自己面前，并执行能力栏中的效果
- 调和 (HARMONY) - 将卡牌背面朝上放置在调和区
- 质疑 (DOUBT) - 将卡牌背面朝上放置在其他玩家面前

## 游戏状态

- WAITING - 等待玩家加入
- PLAYING - 游戏进行中
- SPECIAL_PHASE - 特殊阶段（如优等生特技）
- GAME_OVER - 游戏结束
