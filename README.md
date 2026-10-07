# Mini Card Game

一个使用 React、WebSocket 与 Python 构建的 3–5 人在线卡牌游戏。前端通过同一个 WebSocket 服务与后端通信；部署镜像同时包含前端静态文件、Nginx 和后端。

## 当前功能

- 支持 3、4 或 5 名玩家；3–4 人每人 6 张牌，5 人每人 5 张。
- 房间码隔离的对局：可创建房间或加入已有房间；第一位进入房间的玩家为房主。
- 登录认证、同房间重连令牌与浏览器自动重连。
- 服务端按玩家过滤游戏状态：仅本人能看到自己的手牌，调和区和质疑区在结算前保持隐藏。
- 三种出牌方式（特技、调和、质疑）、特殊阶段和服务器权威的结算。
- 房间内按住说话语音聊天：Opus 录音分片经 WebSocket 按房间转发，大厅不可用。

游戏规则、卡牌数据和结算顺序以 [游戏概览](docs/overview.md) 为准。

## 本地开发

需要 GNU Make、[uv](https://docs.astral.sh/uv/)、Python 3.10 和 Node.js 20。在项目根目录安装依赖并启动前后端：

```powershell
make setup
make worktree
```

先运行 `make setup` 安装依赖，再运行 `make worktree`（或 `make dev`）启动。命令会自动选择并锁定空闲端口，打印前端和后端地址；多个 worktree 可以同时运行。也可用 `make worktree DEV_SLOT=12` 指定槽位，命令会先检查端口可用性。详见 [快速启动](docs/QUICK_START.md)。

本地浏览器验收可运行 `make e2e`，覆盖 CI 的桌面与移动 E2E，并在 `frontend/test-results/` 生成多玩家录像、`multiview.html`、截图和报告。首次运行执行 `make e2e-install-browser` 会安装依赖和 Chromium。

## 验证命令

```powershell
cd backend
uv sync --frozen
uv run pytest tests/ -v --tb=short
```

```powershell
cd frontend
npm ci
npm test
npm run lint
npm run build
npm run test:e2e
npm run test:e2e:mobile
```

浏览器 E2E 首次运行需执行 `npx playwright install chromium`。桌面命令依次运行三人完整牌局冒烟和四人确定性玩法场景；移动命令在 844×390 运行精选复杂场景。每套产物都包含逐玩家 WebM、同步多视角 `multiview.html`、时间线、截图和覆盖报告，写入 `frontend/test-results/` 下对应目录。

## 部署与安全

发布镜像、Docker Compose 部署、配置及回滚操作见 [部署指南](docs/DEPLOY.md)。公网部署至少应设置 `ALLOWED_ORIGINS`，并用 `password_hash` 替换演示账号的明文密码；不要开启旧客户端兼容开关，除非确有迁移需要。

## 文档

- [快速启动](docs/QUICK_START.md)
- [游戏概览与规则](docs/overview.md)
- [开发协作与 CI](docs/DEVELOPMENT_WORKFLOW.md)
- [部署指南](docs/DEPLOY.md)
- [本地 Docker 指南](docs/DOCKER.md)
- [前端说明](frontend/README.md)
- [后端说明](backend/README.md)
