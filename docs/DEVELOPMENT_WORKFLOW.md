# 开发协作流程

## 分支和 Pull Request

- 不要直接推送到 `main`；每项改动使用独立分支和 PR。
- 从最新的 `main` 创建分支，命名为 `codex/issue-<number>-<short-description>`，例如 `codex/issue-93-align-docs`。
- PR 合并前应通过 GitHub Actions；合并后才可从 `main` 打发布 tag。
- Issue 是工作单元：先查找并认领现有 Issue；无匹配项时创建含目标、范围、验收标准、验证命令和非目标的 agent-ready Issue。

## 本地验证

GitHub CI 使用下列命令；提交前应运行与改动相关的一组：

```powershell
cd backend
uv sync --frozen
uv run pytest tests/ -v --tb=short
```

```powershell
cd frontend
npm ci
npm run lint
npm test
npm run build
```

完整浏览器验证：

```powershell
cd frontend
npx playwright install chromium
npm run test:e2e
npm run test:e2e:mobile
```

## GitHub Actions

`.github/workflows/ci.yml` 在向 `main` 或 `master` 推送以及所有 PR 上运行：

| Job | 运行环境 | 验证 |
| --- | --- | --- |
| Backend | Ubuntu、Python 3.10、uv | `uv sync --frozen`；`uv run pytest tests/ -v --tb=short` |
| Frontend | Ubuntu、Node.js 20 | `npm ci`；lint；`npm test`；build |
| Browser E2E | Ubuntu、Python 3.10、Node.js 20、Chromium | 运行完整牌局冒烟与桌面确定性场景，上传逐玩家录像、多视角播放器、截图和覆盖报告（14 天） |
| Mobile E2E | Ubuntu、Python 3.10、Node.js 20、Chromium | 在 844×390 运行精选复杂场景并上传同结构多视角产物（14 天） |

`.github/workflows/build-push.yml` 只在推送 `v*` tag 时运行。它重新验证后端测试和前端 lint/build，再用 `Dockerfile.deploy` 构建并推送 Docker Hub 镜像的版本 tag 与 `latest`。该工作流需要 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN` secrets；它不是每个 PR 的镜像发布。

## 发版

1. 合并 PR 并确认 `main` 的 CI 为绿色。
2. 在更新后的 `main` 创建并推送语义化版本 tag：

   ```powershell
   git switch main
   git pull origin main
   git tag -a v1.0.0 -m "v1.0.0: description"
   git push origin v1.0.0
   ```

3. 等待 Build and Push 工作流发布镜像，随后按 [部署指南](DEPLOY.md) 用该 tag 部署。

游戏与安全行为的变更必须同步更新 [游戏概览](overview.md)；运行时和部署配置的变更必须同步更新 [部署指南](DEPLOY.md)。
