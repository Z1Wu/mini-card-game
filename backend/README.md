# 后端

Python WebSocket 服务负责房间、认证、对局状态、私有状态过滤和结算。它只支持 3–5 名玩家；游戏和协议行为以 [游戏概览](../docs/overview.md) 为准。

## 运行

需要 Python 3.10+ 与 uv：

```powershell
cd backend
uv sync --frozen
uv run python main.py
```

默认监听 `ws://localhost:8765`。完整本地启动说明见 [快速启动](../docs/QUICK_START.md)。

## 验证

```powershell
cd backend
uv sync --frozen
uv run pytest tests/ -v --tb=short
```

测试目录和可选的筛选命令见 [测试说明](tests/README.md)。

## 协议要点

1. 未登录连接先发送 `create_room` 或 `join_room`；默认房间为 `default`。
2. 在选定房间发送 `login`（用户名和密码）。成功响应携带玩家身份、房间码和重连令牌。
3. 断线恢复时先加入原房间（非默认房间），再发送 `reconnect` 和重连令牌。
4. 已认证玩家才能开始、重置、出牌或处理特技。房主控制开始和重置。

服务端按接收者序列化状态：手牌仅发送给持有者；调和区、质疑区和其他玩家手牌在结算前仅以不含角色信息的占位形式发送。客户端不得依赖或尝试推断隐藏状态。

## 配置和生产安全

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | 监听地址 |
| `PORT` | `8765` | WebSocket 端口 |
| `AUTH_USERS_FILE` | `backend/auth/users.json` | 用户配置文件 |
| `ALLOWED_ORIGINS` | 未限制 | 逗号分隔的允许 Origin；公网部署必须设置 |
| `ROOM_TTL_SECONDS` | `300` | 非默认空房间的清理时间（秒） |
| `MAX_MESSAGES_PER_SECOND` | `30` | 单连接速率上限 |
| `ALLOW_LEGACY_JOIN_GAME` | `false` | 仅旧客户端迁移时启用的未认证兼容协议 |

仓库内的明文用户仅供本地演示与自动化测试。生产使用 `password_hash`：

```bash
cd backend
python -m auth.passwords 'replace-with-a-strong-password'
```

将输出填入用户 JSON 的 `password_hash` 字段。镜像、环境变量注入和用户文件只读挂载见 [部署指南](../docs/DEPLOY.md)。
