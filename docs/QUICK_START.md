# 快速启动

本项目由 React 前端和 Python WebSocket 后端组成。支持 3–5 名玩家；请用三个或更多浏览器会话进行本地试玩。

## 1. 启动后端

需要 Python 3.10+ 和 uv：

```powershell
cd backend
uv sync --frozen
uv run python main.py
```

后端默认监听 `ws://localhost:8765`。

## 2. 启动前端

另开一个终端（需要 Node.js 20）：

```powershell
cd frontend
npm ci
npm run dev
```

在 Vite 输出的地址中打开三个或更多浏览器会话。不要使用旧的 `frontend/demo.html`：当前客户端由 Vite 构建和提供。

## 3. 创建房间并开始

1. 第一位玩家在登录页创建房间，记录六位房间码并登录；该玩家成为房主。
2. 其他玩家输入同一房间码并使用各自账号登录。
3. 房主在大厅中等待 3–5 名玩家到齐后开始游戏。

浏览器短暂断线时会尝试使用会话中的重连令牌回到原房间。主动退出会清除本地会话；非默认的空房间会在 `ROOM_TTL_SECONDS` 后清理，默认值为 300 秒。

账号来自 `backend/auth/users.json`，仅用于本地演示和测试。公网配置及安全密码说明见 [部署指南](DEPLOY.md)。

## 4. 验证

```powershell
cd backend
uv run pytest tests/ -v --tb=short
```

```powershell
cd frontend
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

更多开发、CI 与发版信息见 [开发协作流程](DEVELOPMENT_WORKFLOW.md)。游戏规则见 [游戏概览](overview.md)。
