# 服务器部署说明

本文说明在云服务器（如阿里云、腾讯云学生机）上部署本项目的注意事项与步骤。

## 一、部署方式概览

- **推荐**：使用 CI 发布到 Docker Hub 的 **Docker 单镜像**（前端 + 后端 + Nginx），对外只暴露 **80 端口**，适合单机部署。
- 使用提供的 `deploy.sh` 和 `docker-compose.deploy.yml` 可在服务器上拉取并启动指定版本。

## 二、部署前注意事项

### 1. 防火墙 / 安全组

- 必须开放 **80 端口**（HTTP），否则外网无法访问。
- 若通过 SSH 管理服务器，保留 **22 端口**。
- **不要**对公网开放 8765（WebSocket 已由 Nginx 在 80 上反代，无需单独暴露）。

**阿里云 / 腾讯云**：在控制台找到该实例的「安全组」，添加入方向规则：协议 TCP，端口 80，来源 0.0.0.0/0（或按需限制）。

### 2. 登录用户配置（必需）

- **生产部署不会使用镜像内的演示账号。** 启动时必须挂载自己的用户配置文件，并由 `AUTH_USERS_FILE` 显式指向该文件。
- 所有生产账号都必须使用 `password_hash`；包含明文 `password` 字段的文件会让后端在启动前失败。
- 格式为 JSON 数组，例如：
  ```json
  [
    { "username": "player1", "password_hash": "pbkdf2_sha256$...", "name": "玩家1" },
    { "username": "player2", "password_hash": "pbkdf2_sha256$...", "name": "玩家2" }
  ]
  ```
- 用 `cd backend && python -m auth.passwords "你的强密码"` 生成 hash。不要将真实用户文件或密码提交到 Git。

### 3. 浏览器来源策略（必需）

- 生产环境必须显式设置 `ALLOWED_ORIGINS` 为允许访问 WebSocket 的、逗号分隔的 HTTP(S) 来源，例如 `https://cards.example.com`。
- 不允许 `*`、路径（如 `https://cards.example.com/app`）或其他协议；缺失或不安全的值会让服务在启动前失败。
- 若通过同一个公开域名提供此镜像，请将该域名设为唯一来源。可以临时添加本地调试来源，例如 `https://cards.example.com,http://localhost:5173`。

### 4. 使用 IP 访问、无需备案

- 直接使用服务器公网 IP 访问（如 `http://1.2.3.4`）时，**不需要域名备案**。
- 若日后使用域名并解析到国内服务器，再考虑备案；仅 IP 访问无需备案。

### 5. HTTP 与 WebSocket

- 当前为 **HTTP + ws**（非 HTTPS），浏览器会显示「不安全」提示，但不影响使用。
- 手机浏览器可正常访问；只要页面是 HTTP，`ws://` 不会被拦截。

## 三、使用 docker-compose 在服务器部署

> 日常发布不需要在服务器保存仓库代码。推荐从开发机运行
> `./scripts/deploy-remote.sh v1.0.8 [deploy-host]`：它经 SSH 让服务器拉取已经由
> GitHub Actions 发布的版本镜像。SSH 私钥只保留在执行该脚本的本地机器上。
> 不传 `deploy-host` 时默认使用 SSH 配置中的 `tc_cloud_2026_vm`。

### 1. 准备目录与配置

在服务器上克隆或上传项目后，进入项目根目录：

```bash
cd /path/to/card_game_dev
```

复制示例、生成各账号的密码 hash，并设置公开站点的允许来源：

```bash
cp deploy-data/users.json.example deploy-data/users.json
# 编辑 deploy-data/users.json，替换每个占位 password_hash
cd backend && python -m auth.passwords "为每个账号使用不同的强密码"
cd ..
# 创建 .env（不要提交），设置实际公开来源
printf 'ALLOWED_ORIGINS=https://cards.example.com\n' > .env
```

`docker-compose.deploy.yml` 已经挂载 `deploy-data/users.json`。该文件缺失、仍含占位值、含明文密码，或 `.env` 中缺少 `ALLOWED_ORIGINS` 时，后端会拒绝启动。

### 2. 拉取 CI 镜像并启动

```bash
# 推荐固定版本，方便回滚
IMAGE_TAG=v1.0.8 ./deploy.sh

# 或拉取 latest
./deploy.sh
```

`deploy.sh` 会先从 Docker Hub 拉取镜像，再在后台创建或更新容器。默认镜像是 `z1wu97/mini-card-game`；如果 fork 了仓库并将 CI 镜像发布到其他账号，可以同时覆盖镜像名：

```bash
CARD_GAME_IMAGE=your-account/mini-card-game IMAGE_TAG=v1.0.8 ./deploy.sh
```

### 3. 常用命令

```bash
# 查看日志
docker compose -f docker-compose.deploy.yml logs -f

# 停止
docker compose -f docker-compose.deploy.yml down

# 重启（例如修改 users.json 后）
docker compose -f docker-compose.deploy.yml restart
```

### 4. 访问

- 浏览器访问：`http://你的服务器公网IP`
- 手机同理，输入同一地址即可。

## 四、docker-compose.deploy.yml 说明

- **服务**：单服务 `app`，默认拉取 CI 发布的 `z1wu97/mini-card-game:latest`，对外映射 **80:80**。
- **版本**：通过 `IMAGE_TAG` 选择版本，通过 `CARD_GAME_IMAGE` 覆盖镜像仓库。
- **重启策略**：`restart: unless-stopped`，服务器重启后容器会自动起来。
- **生产安全配置**：Compose 设置 `APP_ENV=production`，挂载 `./deploy-data/users.json` 到容器，并要求从 `.env` 读取 `ALLOWED_ORIGINS`。示例配置见 `deploy-data/users.json.example`；绝不能提交实际文件。

## 五、仅用 Docker 命令（不用 compose）

与 docker-compose 一致，Docker 直接运行时也必须提供 hash-only 用户配置与明确来源策略。

### 1. 准备挂载文件

```bash
mkdir -p deploy-data
cp deploy-data/users.json.example deploy-data/users.json
# 编辑 deploy-data/users.json，填入 password_hash，不要填入明文 password
```

### 2. 拉取并运行

**安全的生产启动**：

```bash
docker pull z1wu97/mini-card-game:v1.0.8
docker run -d -p 80:80 --restart unless-stopped --name card-game \
  -e APP_ENV=production \
  -e AUTH_USERS_FILE=/app/config/users.json \
  -e ALLOWED_ORIGINS=https://cards.example.com \
  -v $(pwd)/deploy-data/users.json:/app/config/users.json:ro \
  z1wu97/mini-card-game:v1.0.8
```

`Dockerfile.deploy` 仍保留在仓库中，供 CI 构建发布镜像，也可用于本地调试构建。

## 六、故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 外网无法打开页面 | 安全组/防火墙未放行 80 | 在云控制台开放 80 端口 |
| 后端启动即退出 | 缺少安全生产配置 | 配置 `APP_ENV=production`、`AUTH_USERS_FILE`、非空的 `ALLOWED_ORIGINS`，并挂载 hash-only users.json |
| 登录提示「Invalid username or password」 | users.json 不正确 | 检查挂载路径、JSON 格式和 password_hash |
| 页面能开但无法连上/断线 | Nginx 未正确反代 /ws | 查看容器日志 `docker compose -f docker-compose.deploy.yml logs`，确认后端与 Nginx 均正常 |

## 七、CI/CD（GitHub Actions）

每次向 `main` / `master` 分支 **push** 或发起 **pull request** 时，CI 会自动运行：

- **Backend**：安装依赖（uv）、仅运行带 `@pytest.mark.unit` 的单元测试  
- **Frontend**：`npm ci`、`npm run lint`、`npm run build`  

配置见 `.github/workflows/ci.yml`。推送 `v*` tag 时，`.github/workflows/build-push.yml` 会在测试通过后构建 `Dockerfile.deploy`，并发布版本 tag 和 `latest` 镜像到 Docker Hub。

## 八、相关文件

- `Dockerfile.deploy`：CI 发布的部署镜像构建文件
- `docker-compose.deploy.yml`：服务器拉取并运行发布镜像的 Compose 配置
- `deploy.sh`：拉取指定版本并更新服务
- `deploy/nginx.conf`：Nginx 配置（/ 静态，/ws 反代）  
- `deploy/start.sh`：容器启动脚本（先起后端再起 Nginx）  
- `.github/workflows/ci.yml`：Push/PR 时的 CI 流程  
- [DOCKER.md](DOCKER.md)：开发与本地 Docker 用法
