# 快速启动

本项目由 React 前端和 Python WebSocket 后端组成。支持 3–5 名玩家；请用三个或更多浏览器会话进行本地试玩。

## 1. 安装并启动本地环境

需要 GNU Make、Python 3.10、uv、Node.js 20 和 npm。在仓库根目录运行以下命令安装依赖并启动前后端：

```powershell
make setup
make worktree
```

首次运行前用 `make setup` 安装依赖。Makefile 会让 uv 使用 Python 3.10、检查 Node.js 主版本为 20，并自动选择、锁定空闲的前端、后端和管理 API 端口；终端会打印实际访问地址。这样多个 worktree 可以同时运行。也可指定槽位，例如 `make worktree DEV_SLOT=12`（范围 0–999）；命令会先检查该槽位端口。

打开 `make worktree` 输出的前端地址并使用三个或更多浏览器会话。不要使用旧的 `frontend/demo.html`：当前客户端由 Vite 构建和提供。

## 2. 创建房间并开始

1. 第一位玩家在登录页创建房间，记录六位房间码并登录；该玩家成为房主。
2. 其他玩家输入同一房间码并使用各自账号登录。
3. 房主在大厅中等待 3–5 名玩家到齐后开始游戏。

浏览器短暂断线时会尝试使用会话中的重连令牌回到原房间。主动退出会清除本地会话；非默认的空房间会在 `ROOM_TTL_SECONDS` 后清理，默认值为 300 秒。

账号来自 `backend/auth/users.json`，仅用于本地演示和测试。公网配置及安全密码说明见 [部署指南](DEPLOY.md)。

## 3. 验证

运行与 GitHub Actions 浏览器验收相同的桌面和移动 E2E 套件：

```powershell
make e2e
```

首次运行前安装 Playwright Chromium：

```powershell
make e2e-install-browser
```

验收产物保存在 `frontend/test-results/` 下的 `full-game/`、`scenarios/`、`voice-chat/`、`avatar-profile/` 和 `mobile-game/` 目录。打开 `full-game/`、`scenarios/`、`mobile-game/` 中的 `multiview.html` 可同步查看玩家录像；`report.json` 与截图用于核对结果，语音和头像场景的证据也在各自目录中。也可分别运行 `make e2e-desktop` 或 `make e2e-mobile`。

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
