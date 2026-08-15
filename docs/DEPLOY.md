# 部署指南

正式镜像将 Vite 构建产物、Nginx 与 Python WebSocket 后端打包在一起：Nginx 提供 `/`，并将 `/ws` 反向代理到 `127.0.0.1:8765`。容器只暴露 HTTP 80 端口。

## 发布镜像

向 GitHub 推送 `v*` tag 会触发 `Build and Push Image` 工作流。该工作流先运行后端测试和前端 lint/build，然后使用 `Dockerfile.deploy` 推送：

- `docker.io/<DOCKERHUB_USERNAME>/mini-card-game:<tag>`
- `docker.io/<DOCKERHUB_USERNAME>/mini-card-game:latest`

仓库默认部署目标为 `z1wu97/mini-card-game`。发布工作流需要仓库 secrets `DOCKERHUB_USERNAME` 与 `DOCKERHUB_TOKEN`。

## 服务器部署（Compose）

在服务器上取得 `docker-compose.deploy.yml`、`deploy.sh` 和 `deploy-data/users.json`（见下节），然后执行：

```bash
IMAGE_TAG=v1.0.0 ./deploy.sh
```

脚本拉取镜像并运行：

```bash
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d --remove-orphans
```

默认使用 `latest`。部署 fork 或其他镜像仓库时覆盖镜像名：

```bash
CARD_GAME_IMAGE=your-account/mini-card-game IMAGE_TAG=v1.0.0 ./deploy.sh
```

常用操作：

```bash
docker compose -f docker-compose.deploy.yml logs -f
docker compose -f docker-compose.deploy.yml restart
docker compose -f docker-compose.deploy.yml down
```

访问 `http://<server-address>/`；WebSocket 使用同一站点的 `/ws` 路径。

## 用户和安全配置

生产部署**不会使用镜像内的演示账号**。`docker-compose.deploy.yml` 设置 `APP_ENV=production`、挂载 `./deploy-data/users.json`，并要求从 `.env` 读取 `ALLOWED_ORIGINS`；缺少任一必需配置时后端会在启动前失败，避免以不安全默认值对外提供服务。

### 创建初始管理员

首次部署后，使用 `deploy/init-admin.sh` 在运行中的容器内创建管理员账号。密码自动以 PBKDF2 hash 写入 `deploy-data/users.json`，不会出现在进程列表中：

```bash
# 启动容器后执行
./deploy/init-admin.sh admin 'strong-password' '超级管理员'
```

创建后即可用该账号登录管理界面 `https://<your-domain>/`。后续的用户管理可以直接在管理界面中完成。

也可以通过 CLI 在容器外直接创建（需要本地 Python 环境）：

```bash
cd backend
uv run python -m auth.bootstrap admin 'strong-password' --name '超级管理员' --users-file ../deploy-data/users.json
```

### 手动配置用户文件

如果需要批量预置用户，可以手动编辑 `deploy-data/users.json`：

1. 复制示例并替换占位哈希：

```bash
cp deploy-data/users.json.example deploy-data/users.json
cd backend
python -m auth.passwords '为每个账号使用不同的强密码'
```

2. 所有生产账号必须使用 `password_hash`（PBKDF2 格式）；包含明文 `password` 字段的文件会让后端拒绝启动。不要将真实用户文件提交到 Git。

3. 创建 `.env`（不要提交），设置公开站点的允许来源：

```bash
printf 'ALLOWED_ORIGINS=https://cards.example.com\n' > .env
```

生产环境 `ALLOWED_ORIGINS` 必须是逗号分隔的显式 HTTP(S) 来源；不允许 `*`、路径或其他协议。

### 环境变量

| 变量 | 用途 |
| --- | --- |
| `APP_ENV` | `production` 时启用启动前安全校验；本地开发默认 `development` |
| `ALLOWED_ORIGINS` | 逗号分隔的允许 WebSocket Origin；生产必填 |
| `AUTH_USERS_FILE` | 用户 JSON 的路径；Compose 已设为 `/app/config/users.json` |
| `ROOM_TTL_SECONDS` | 非默认空房间的保留秒数；默认 `300` |
| `MAX_MESSAGES_PER_SECOND` | 单连接消息速率上限；默认 `30` |
| `ALLOW_LEGACY_JOIN_GAME` | 仅为旧客户端迁移设置为 `true`；默认关闭 |
| `ADMIN_HTTP_PORT` | 管理员 HTTP API 端口；默认 `8766` |
| `ADMIN_SESSION_TTL` | 管理员 session 过期秒数；默认 `3600` |

部署平台必须把这些变量传入后端进程；当前 Compose 文件已定义镜像、端口、用户文件挂载与必需环境变量，可按平台的环境变量机制扩展它。不要为了生产兼容性开启 `ALLOW_LEGACY_JOIN_GAME`。

## 回滚

保留上一个已验证的镜像 tag。发生问题时以该 tag 重新运行部署：

```bash
IMAGE_TAG=v0.9.0 ./deploy.sh
```

确认页面加载、`/ws` 可连接、登录成功，以及三个玩家能加入同一房间后再宣布回滚完成。

本地容器构建与开发使用说明见 [DOCKER.md](DOCKER.md)；发布过程见 [开发协作流程](DEVELOPMENT_WORKFLOW.md)。
