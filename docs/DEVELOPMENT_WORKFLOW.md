# 项目开发协作流程

本文档说明本项目的分支策略、CI/CD、发版流程，以及日常开发中常用的 AI 提示词（prompt），便于团队协作与 Cursor/AI 辅助开发。

---

## 一、分支与合并规范

- **禁止**将功能或修复**直接推送到 `main`**。所有改动必须通过 **Pull Request (PR)** 合入。
- 在功能分支上开发：
  - 从 `main` 拉取最新后创建分支，例如：`feature/xxx`、`fix/xxx`。
  - 在分支上提交（commit），推送到远程后创建 PR，目标分支为 `main`。
- **合并前**：必须确保 **GitHub Actions CI 全部通过**（见下文）。若 CI 失败，在 PR 内修复并推送，直到通过后再合并。
- **合并与发版**：只在 PR 已合并、且当前 `main` 的 CI 为绿色后，再在 `main` 上打 tag 发版。

---

## 二、CI 流程

| 触发条件 | 工作流 | 说明 |
|----------|--------|------|
| Push / PR 到 `main` | **CI** (`.github/workflows/ci.yml`) | 后端单元测试（`pytest tests/ -m unit`）、前端 `npm ci` + `npm run lint` + `npm run build` |
| 推送 tag `v*` | **Build and Push** (`.github/workflows/build-push.yml`) | 先跑与 CI 相同的测试，通过后构建 Docker 镜像并推送到 Docker Hub（需配置 `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN`） |

本地在提交前建议跑一遍：

```bash
# 后端
cd backend && uv run pytest tests/ -m unit -v

# 前端
cd frontend && npm ci && npm run lint && npm run build
```

---

## 三、发版流程

1. **合并 PR**：在 GitHub 上合并目标分支到 `main`（建议 squash），确保 CI 已通过。
2. **打 tag**：在本地拉取最新 `main` 后打版本 tag，例如 `v1.0.7`：
   ```bash
   git checkout main && git pull origin main
   git tag -a v1.0.7 -m "v1.0.7: 简短说明"
   git push origin v1.0.7
   ```
3. **Release**：可在 GitHub 的 Releases 页面基于该 tag 创建 Release，填写版本说明。
4. **镜像**：推送 `v*` tag 后，Build and Push 工作流会自动跑测试并构建、推送镜像到 Docker Hub（如 `xxx/mini-card-game:v1.0.7` 和 `latest`）。

---

## 四、常用 AI 提示词（Prompt）

以下提示词可用于 Cursor / 其他 AI 辅助开发，按场景分类。使用时可根据实际情况替换括号内的说明。

### 4.1 分支与提交

- **从 main 建分支并提交推送**  
  「从 main fork 一个新分支，把这些修改 commit 一下，然后推送到 remote 吧」

- **指定分支名**  
  「从 main 新建分支 `feature/xxx`，把当前改动 commit 并 push 到 origin」

### 4.2 PR 与合并

- **创建 PR**  
  「你帮我创建一个 pr 吧」  
  （当前分支会作为 head，base 一般为 `main`）

- **CI 通过后合并并发版**  
  「pr 如果 ci 流程通过了，直接合并进去，然后发一个新版本吧」

- **仅合并 PR**  
  「PR 通过后合并到 main，用 squash」

### 4.3 发版

- **打 tag 并推送**  
  「在 main 上打 tag v1.0.x，推送并创建 GitHub Release，写清楚本次变更」

- **发版说明**  
  「按这次 PR 的改动，写一版 Release notes，用于 v1.0.x」

### 4.4 CI 与测试

- **修 CI**  
  「修复当前 commit 的 CI：后端单元测试、前端 ESLint 都通过」

- **跑测试**  
  「跑一下后端单元测试 / 前端 lint，看有没有报错」

- **加测试**  
  「给刚才的逻辑加一个单元测试，覆盖 xxx 情况」

### 4.5 规则与需求（基于 docs/overview.md）

- **按文档改规则**  
  「按照 @docs/overview.md 新增的规则描述，修改 xxx（例如：玩家个数与手牌关系、调和目标值与人数关系）」

- **游戏逻辑**  
  「手牌剩一张时不能出牌，要等所有人都剩一张再胜利判定」  
  「以质疑/调和形式出牌时不要发动牌的特技」  
  「新闻部用调和时不要触发换牌；换牌时不能选上家刚递过来的牌」

### 4.6 部署与文档

- **部署**  
  「按 docs/DEPLOY.md 在服务器上用 Docker 部署，并说明访问方式」  
  「发一个 hotfix 版本并推送镜像」

- **文档**  
  「按我们目前的开发流程，整理一下项目开发协作流程文档，并把常见的提示词也写进文档」

---

## 五、相关文档与配置

| 文档/配置 | 说明 |
|----------|------|
| [docs/overview.md](./overview.md) | 游戏规则与卡牌说明，需求以此处为准 |
| [docs/QUICK_START.md](./QUICK_START.md) | 本地快速启动与演示 |
| [docs/DEPLOY.md](./DEPLOY.md) | 服务器部署（Docker、Nginx、访问方式） |
| [.cursor/rules/pr-and-release.mdc](../.cursor/rules/pr-and-release.mdc) | Cursor 规则：禁止直推 main、PR+CI 后合并与发版 |

---

## 六、版本号约定

- 采用**语义化版本** `v主.次.修订`（如 `v1.0.6`）。
- 小功能或规则调整：修订号 +1。
- 不兼容的规则或 API 变更：视情况升次版本号。
