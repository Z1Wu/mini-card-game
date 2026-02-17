# 卡牌游戏后端

多人在线卡牌游戏后端服务，使用 Python + WebSocket 实现。

## 项目结构

```
card_game_dev/
├── backend/                    # 后端代码
│   ├── game/                  # 游戏逻辑
│   │   ├── models.py         # 数据模型
│   │   ├── state.py          # 游戏状态管理
│   │   ├── cards.py          # 卡牌系统
│   │   ├── rules.py          # 游戏规则
│   │   └── victory.py        # 胜利条件判定
│   ├── websocket/            # WebSocket 服务
│   │   └── server.py         # WebSocket 服务器
│   ├── utils/                # 工具函数
│   ├── tests/                # 测试代码
│   │   ├── test_client.py    # 测试客户端
│   │   ├── test_game_flow.py # 游戏流程测试
│   │   ├── test_game_state.py # 游戏状态测试
│   │   ├── test_cards.py     # 卡牌测试
│   │   └── test_basic.py     # 基础测试
│   ├── main.py               # 主程序入口
│   ├── config.py             # 配置文件
│   └── pyproject.toml       # 项目配置和依赖管理（uv）
├── docs/                     # 文档
│   ├── overview.md           # 游戏规则概述
│   ├── backend_implementation.md  # 后端实现方案
│   ├── backend_testing.md    # 后端测试方案
│   └── DOCKER.md            # Docker 部署指南
├── Dockerfile               # Docker 镜像配置
├── docker-compose.yml       # Docker Compose 配置
└── docker.sh               # Docker 部署脚本
```

## 功能特性

- ✅ 支持 3-6 人游戏
- ✅ 13 种卡牌类型
- ✅ 三种出卡方式（特技、调和、质疑）
- ✅ 特殊交互机制（优等生闭眼、外星人响应）
- ✅ 完整的胜利条件判定
- ✅ 实时 WebSocket 通信
- ✅ 异步高并发处理
- ✅ Docker 容器化部署
- ✅ 使用 uv 管理依赖

## 快速开始

### 使用 Docker（推荐）

1. 构建镜像：

```bash
./docker.sh build
```

2. 启动服务：

```bash
./docker.sh start
```

3. 查看日志：

```bash
./docker.sh logs
```

4. 运行测试：

```bash
./docker.sh test
```

### 使用 uv（本地开发）

1. 安装 uv：

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# 使用 pip
pip install uv
```

2. 进入 backend 目录：

```bash
cd backend
```

3. 同步依赖：

```bash
uv sync
```

4. 启动服务：

```bash
uv run python main.py
```

5. 运行测试：

```bash
uv run pytest tests/
```

## uv 使用指南

### 常用命令

```bash
# 进入 backend 目录
cd backend

# 同步依赖
uv sync

# 安装新包
uv add package_name

# 安装开发依赖
uv add --dev package_name

# 运行脚本
uv run python script.py

# 运行测试
uv run pytest tests/

# 更新依赖
uv lock --upgrade

# 查看已安装的包
uv pip list
```

### 项目配置

依赖配置在 `backend/pyproject.toml` 中：

```toml
[project]
name = "card-game-backend"
version = "0.1.0"
dependencies = [
    "websockets>=12.0",
    "pydantic>=2.0.0",
    "python-dotenv>=1.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
    "pytest-cov>=4.0.0",
]
```

### 虚拟环境

uv 自动创建和管理虚拟环境：

```bash
# 进入 backend 目录
cd backend

# 激活虚拟环境
source .venv/bin/activate  # Linux/macOS
.venv\Scripts\activate     # Windows

# 退出虚拟环境
deactivate
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
    "required_harmony_value": 4
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

| 卡牌名称 | 费用 | 调和值 | 胜利优先级 | 胜利条件 | 张数 |
|---------|------|--------|-----------|---------|------|
| 班长 | 2 | 2 | 4 | 调和成功 | 2 |
| 图书委员 | 1 | 1 | 4 | 调和成功 | 2 |
| 外星人 | -1 | 1 | 1 | 被监禁 | 1 |
| 归宅部 | 0 | 0 | 5 | 无任何人获胜 | 3 |
| 保健委员 | 1 | 2 | 4 | 调和成功 | 2 |
| 风纪委员 | 1 | 2 | 4 | 调和成功 | 2 |
| 新闻部 | 1 | 1 | 4 | 调和成功 | 3 |
| 大小姐 | 1 | 1 | 4 | 调和成功 | 3 |
| 共犯 | 0 | 0 | 3 | 犯人获胜 | 1 |
| 感染者 | 0 | 0 | 2 | 调和失败 | 1 |
| 犯人 | 0 | 0 | 3 | 不被监禁 | 1 |
| 学生会长 | 3 | 3 | 4 | 调和成功 | 1 |
| 优等生 | 2 | 2 | 4 | 不被监禁 | 2 |

## 出卡方式

- **特技 (SKILL)** - 将卡牌正面朝上放置在自己面前，并执行能力栏中的效果
- **调和 (HARMONY)** - 将卡牌背面朝上放置在调和区
- **质疑 (DOUBT)** - 将卡牌背面朝上放置在其他玩家面前

## 游戏状态

- **WAITING** - 等待玩家加入
- **PLAYING** - 游戏进行中
- **SPECIAL_PHASE** - 特殊阶段（如优等生特技）
- **GAME_OVER** - 游戏结束

## 测试

### 使用 uv 运行测试

```bash
# 进入 backend 目录
cd backend

# 运行所有测试
uv run pytest tests/

# 运行特定测试文件
uv run pytest tests/test_game_state.py

# 运行测试并显示详细输出
uv run pytest tests/ -v

# 运行测试并生成覆盖率报告
uv run pytest tests/ --cov=. --cov-report=html
```

### 运行集成测试

```bash
cd backend
uv run python tests/test_game_flow.py
```

### 运行基础测试

```bash
cd backend
uv run python tests/test_basic.py
```

## 文档

- [游戏规则概述](docs/overview.md) - 游戏规则和卡牌详情
- [后端实现方案](docs/backend_implementation.md) - 后端架构和实现细节
- [后端测试方案](docs/backend_testing.md) - 测试方法和工具
- [Docker 部署指南](docs/DOCKER.md) - Docker 部署和运维

## 技术栈

- **Python 3.10+**
- **uv** - 快速的 Python 包管理器
- **websockets** - WebSocket 服务器
- **pydantic** - 数据验证
- **asyncio** - 异步编程
- **Docker** - 容器化部署

## 开发

### 添加新依赖

```bash
# 进入 backend 目录
cd backend

# 添加生产依赖
uv add package_name

# 添加开发依赖
uv add --dev package_name
```

### 添加新卡牌

1. 在 `backend/game/cards.py` 的 `CARD_DATABASE` 中添加卡牌定义
2. 在 `backend/game/rules.py` 中实现卡牌效果
3. 运行测试验证功能

### 添加新功能

1. 在相应的模块中添加代码
2. 编写测试用例
3. 更新文档

## 部署

### Docker 部署

详见 [Docker 部署指南](docs/DOCKER.md)

### 使用 uv 部署

1. 进入 backend 目录：

```bash
cd backend
```

2. 同步依赖：

```bash
uv sync
```

3. 启动服务：

```bash
uv run python main.py
```

4. 使用进程管理器（如 systemd、supervisor）管理服务

## 故障排查

### uv 相关问题

#### uv 命令未找到

```bash
# 重新安装 uv
curl -LsSf https://astral.sh/uv/install.sh | sh
```

#### 依赖安装失败

```bash
# 进入 backend 目录
cd backend

# 清理缓存并重新同步
uv cache clean
uv sync
```

#### 虚拟环境问题

```bash
# 进入 backend 目录
cd backend

# 删除虚拟环境并重新创建
rm -rf .venv
uv sync
```

### 服务无法启动

1. 检查端口是否被占用：`netstat -an | grep 8765`
2. 查看日志：`docker logs card_game_backend`
3. 检查依赖是否安装：`cd backend && uv pip list`

### WebSocket 连接失败

1. 检查服务是否运行：`docker ps`
2. 检查防火墙设置
3. 查看服务日志

## 性能优化

### uv 性能优势

- **快速安装**：比 pip 快 10-100 倍
- **并行下载**：充分利用网络带宽
- **智能缓存**：避免重复下载
- **依赖解析**：快速解析依赖关系

### 其他优化

- 使用异步编程提高并发性能
- 优化 WebSocket 消息处理
- 使用连接池管理数据库连接

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
