# 前端

React + TypeScript + Vite 的游戏客户端。它通过 WebSocket 连接后端，并在浏览器 `sessionStorage` 中保存当前房间、登录用户和重连令牌，以便短暂断线后自动回到同一房间。

## 前置条件与启动

需要 Node.js 20。先按根目录 [快速启动](../docs/QUICK_START.md) 启动后端，再运行：

```powershell
cd frontend
npm ci
npm run dev
```

Vite 输出实际访问地址（默认通常为 `http://localhost:5173`）。开发服务器的 WebSocket 地址由 `VITE_WS_URL` 覆盖；未设置时使用客户端默认地址。生产部署应让该地址指向可访问的后端 WebSocket 端点。

## 可用脚本

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | TypeScript 检查并构建生产文件 |
| `npm run preview` | 本地预览构建产物 |
| `npm run lint` | 运行 ESLint |
| `npm test` | 运行 Vitest 组件测试（一次性） |
| `npm run test:watch` | 以 watch 模式运行组件测试 |
| `npm run test:e2e` | 运行记录式三人浏览器完整对局 |

首次运行浏览器 E2E：

```powershell
npx playwright install chromium
npm run test:e2e
```

默认情况下测试会选择可用端口，不会干扰本地开发服务；产物位于 `test-results/full-game/`。可用 `E2E_BACKEND_PORT`、`E2E_FRONTEND_PORT`、`E2E_OUTPUT_DIR` 和 `E2E_SEED` 覆盖端口、产物目录和确定性发牌种子。

## 对局与隐私边界

登录页可创建六位房间码或加入已有房间。房主才能开始或重置对局；游戏只接受 3–5 名玩家。客户端仅渲染服务端发给该玩家的私有手牌，不能将隐藏区或其他玩家的手牌当作可用数据。有关房间、重连、出牌和结算规则，见 [游戏概览](../docs/overview.md)。

## 部署

项目的正式部署构建位于仓库根目录的 `Dockerfile.deploy`，而不是单独的前端 Dockerfile。它构建 `frontend/dist`，由 Nginx 提供静态资源并将 `/ws` 代理给后端。完整配置见 [部署指南](../docs/DEPLOY.md)。
