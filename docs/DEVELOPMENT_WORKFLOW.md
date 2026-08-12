# 项目开发协作流程

本文档定义本项目通过 GitHub Issue、分支与 Pull Request（PR）协作的方式，支持多人和多个 Agent 安全地并行开发。

**核心原则：Issue 是唯一的开发工作单元；Issue 的 assignee 是开发占用锁；一个 Issue 对应一个分支和一个 PR。**

---

## 一、Issue 驱动的开发流程

### 1. 创建与拆分 Issue

- 所有功能、缺陷、技术债、测试和文档改动都先创建 Issue，再开始编码。
- Issue 必须说明：目标、验收标准、影响范围、风险或依赖；使用仓库 Issue 模板。
- 大需求拆分为可以独立验证、独立合并的小 Issue。后续 Issue 在正文中标注 `Depends on #123` 或 `Blocked by #123`。
- 使用 `agent-ready` 标签表示需求已经清晰、没有未解决依赖，可以直接领取。

### 2. 领取与占用

- 开发前先检查 Issue 是否已有 assignee。
- **未分配**：领取人将自己设为 assignee，并在 Issue 留言说明开始开发的分支或预期范围。
- **已分配**：默认不修改相同范围的代码；需要协作、接手或调整范围时，先在 Issue 中协调并更新 assignee。
- assignee 表示“正在负责”，不是“已完成”。PR 合并并自动关闭 Issue 后才算完成；中止开发时应取消分配并留言说明当前状态。
- 一个 Agent 同时只领取少量可推进的 Issue，避免长期占用和阻塞队列。

### 3. 并行与交接

- 可以并行：相互独立的前端组件、后端规则、测试、文档和基础设施改动。
- 需要协调：同一 WebSocket 协议、游戏状态模型、核心页面或共享配置的改动。相关 Issue 必须显式写明依赖和集成顺序。
- 交接时在 Issue 留下当前分支、已完成内容、尚未完成项、测试结果和已知风险；新负责人接手后更新 assignee。

### 4. 标签约定

建议使用：`frontend`、`backend`、`test`、`docs`、`infra`、`security`、`bug`、`feature`、`blocked`、`agent-ready`。可选的 `agent-in-progress` 仅用于看板展示；是否被开发始终以 assignee 为准。标签描述工作类型和状态，assignee 只描述当前责任人。

---

## 二、分支、PR 与合并规范

- **禁止**将功能或修复**直接推送到 `main`**。所有改动必须通过 **Pull Request (PR)** 合入。
- 在领取 Issue 后，从最新 `main` 创建分支：`codex/issue-<编号>-<简短描述>`，例如 `codex/issue-123-room-invite`。
- 一个分支只解决一个 Issue；不要把无关的本地改动、重构或其他 Issue 混入同一个 PR。
- 推送分支后创建草稿 PR，目标分支为 `main`。PR 正文必须包含 `Closes #<编号>`，以便合并后自动关闭对应 Issue。
- PR 需要说明改动内容、原因、影响、验证方式，以及对后续 Issue 的影响；使用仓库 PR 模板。
- **合并前**：必须确保 **GitHub Actions CI 全部通过**（见下文）。若 CI 失败，在 PR 内修复并推送，直到通过后再合并。
- **合并与发版**：只在 PR 已合并、且当前 `main` 的 CI 为绿色后，再在 `main` 上打 tag 发版。

---

## 三、CI 流程

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

## 四、发版流程

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

## 五、常用 AI 提示词（Prompt）

以下提示词可用于 Cursor / 其他 AI 辅助开发，按场景分类。使用时可根据实际情况替换括号内的说明。

### 5.1 分支与提交

- **领取 Issue 并开始开发**
  「检查 Issue #123 是否未被领取；若可领取，将我设为 assignee，从最新 main 创建 `codex/issue-123-xxx`，只处理该 Issue 的范围。」

- **从 main 建分支并提交推送**  
  「从 main fork 一个新分支，把这些修改 commit 一下，然后推送到 remote 吧」

- **指定分支名**  
  「从 main 新建分支 `feature/xxx`，把当前改动 commit 并 push 到 origin」

### 5.2 PR 与合并

- **创建 PR**  
  「你帮我创建一个 pr 吧」  
  （当前分支会作为 head，base 一般为 `main`）

- **CI 通过后合并并发版**  
  「pr 如果 ci 流程通过了，直接合并进去，然后发一个新版本吧」

- **仅合并 PR**  
  「PR 通过后合并到 main，用 squash」

### 5.3 发版

- **打 tag 并推送**  
  「在 main 上打 tag v1.0.x，推送并创建 GitHub Release，写清楚本次变更」

- **发版说明**  
  「按这次 PR 的改动，写一版 Release notes，用于 v1.0.x」

### 5.4 CI 与测试

- **修 CI**  
  「修复当前 commit 的 CI：后端单元测试、前端 ESLint 都通过」

- **跑测试**  
  「跑一下后端单元测试 / 前端 lint，看有没有报错」

- **加测试**  
  「给刚才的逻辑加一个单元测试，覆盖 xxx 情况」

### 5.5 规则与需求（基于 docs/overview.md）

- **按文档改规则**  
  「按照 @docs/overview.md 新增的规则描述，修改 xxx（例如：玩家个数与手牌关系、调和目标值与人数关系）」

- **游戏逻辑**  
  「手牌剩一张时不能出牌，要等所有人都剩一张再胜利判定」  
  「以质疑/调和形式出牌时不要发动牌的特技」  
  「新闻部用调和时不要触发换牌；换牌时不能选上家刚递过来的牌」

### 5.6 部署与文档

- **部署**  
  「按 docs/DEPLOY.md 在服务器上用 Docker 部署，并说明访问方式」  
  「发一个 hotfix 版本并推送镜像」

- **文档**  
  「按我们目前的开发流程，整理一下项目开发协作流程文档，并把常见的提示词也写进文档」

---

## 六、相关文档与配置

| 文档/配置 | 说明 |
|----------|------|
| [docs/overview.md](./overview.md) | 游戏规则与卡牌说明，需求以此处为准 |
| [docs/QUICK_START.md](./QUICK_START.md) | 本地快速启动与演示 |
| [docs/DEPLOY.md](./DEPLOY.md) | 服务器部署（Docker、Nginx、访问方式） |
| [.cursor/rules/pr-and-release.mdc](../.cursor/rules/pr-and-release.mdc) | Cursor 规则：禁止直推 main、PR+CI 后合并与发版 |

---

## 七、版本号约定

- 采用**语义化版本** `v主.次.修订`（如 `v1.0.6`）。
- 小功能或规则调整：修订号 +1。
- 不兼容的规则或 API 变更：视情况升次版本号。
