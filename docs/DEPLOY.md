# 服务器部署说明

本文说明在云服务器（如阿里云、腾讯云学生机）上部署本项目的注意事项与步骤。

## 一、部署方式概览

- **推荐**：使用 **Docker 单镜像**（前端 + 后端 + Nginx）对外只暴露 **80 端口**，适合单机部署。
- 使用提供的 `docker-compose.deploy.yml` 可在服务器上一键启动。

## 二、部署前注意事项

### 1. 防火墙 / 安全组

- 必须开放 **80 端口**（HTTP），否则外网无法访问。
- 若通过 SSH 管理服务器，保留 **22 端口**。
- **不要**对公网开放 8765（WebSocket 已由 Nginx 在 80 上反代，无需单独暴露）。

**阿里云 / 腾讯云**：在控制台找到该实例的「安全组」，添加入方向规则：协议 TCP，端口 80，来源 0.0.0.0/0（或按需限制）。

### 2. 登录用户配置（重要）

- 登录用的用户名与密码由**配置文件**指定，默认路径：容器内 `/app/backend/auth/users.json`。
- 格式为 JSON 数组，例如：
  ```json
  [
    { "username": "player1", "password": "你的密码", "name": "玩家1" },
    { "username": "player2", "password": "另一密码", "name": "玩家2" }
  ]
  ```
- 部署时请**务必**修改默认密码，或挂载自己的 `users.json`（见下节），避免使用仓库中的示例密码。

### 3. 使用 IP 访问、无需备案

- 直接使用服务器公网 IP 访问（如 `http://1.2.3.4`）时，**不需要域名备案**。
- 若日后使用域名并解析到国内服务器，再考虑备案；仅 IP 访问无需备案。

### 4. HTTP 与 WebSocket

- 当前为 **HTTP + ws**（非 HTTPS），浏览器会显示「不安全」提示，但不影响使用。
- 手机浏览器可正常访问；只要页面是 HTTP，`ws://` 不会被拦截。

## 三、使用 docker-compose 在服务器部署

### 1. 准备目录与配置

在服务器上克隆或上传项目后，进入项目根目录：

```bash
cd /path/to/card_game_dev
```

（可选）若要通过挂载自定义登录用户，可复制示例并修改密码后，再在 `docker-compose.deploy.yml` 中取消 `volumes` 的注释：

```bash
cp deploy-data/users.json.example deploy-data/users.json
# 编辑 deploy-data/users.json，修改各账号密码
```

若不挂载 `users.json`，容器将使用镜像内默认的 `backend/auth/users.json`（部署到生产前建议修改默认密码或使用挂载）。

### 2. 构建镜像并启动

```bash
# 构建部署镜像
docker compose -f docker-compose.deploy.yml build

# 后台启动
docker compose -f docker-compose.deploy.yml up -d
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

- **服务**：单服务 `app`，使用 `Dockerfile.deploy` 构建出的镜像，对外映射 **80:80**。
- **重启策略**：`restart: unless-stopped`，服务器重启后容器会自动起来。
- **挂载**（可选）：在 compose 中取消 `volumes` 注释，并将宿主机 `./deploy-data/users.json` 挂载到容器内 `/app/backend/auth/users.json`，便于在不重建镜像的情况下修改登录账号与密码。示例配置见 `deploy-data/users.json.example`。

## 五、仅用 Docker 命令（不用 compose）

若不想用 compose，可手动构建并运行：

```bash
docker build -f Dockerfile.deploy -t card-game:latest .
docker run -d -p 80:80 --restart unless-stopped --name card-game card-game:latest
```

修改登录用户需进入容器编辑或挂载文件：

```bash
docker run -d -p 80:80 --restart unless-stopped --name card-game \
  -v $(pwd)/deploy-data/users.json:/app/backend/auth/users.json:ro \
  card-game:latest
```

## 六、故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 外网无法打开页面 | 安全组/防火墙未放行 80 | 在云控制台开放 80 端口 |
| 登录提示「Invalid username or password」 | 未挂载或未修改 users.json | 检查挂载路径与 JSON 格式，或进入容器查看 `/app/backend/auth/users.json` |
| 页面能开但无法连上/断线 | Nginx 未正确反代 /ws | 查看容器日志 `docker compose -f docker-compose.deploy.yml logs`，确认后端与 Nginx 均正常 |

## 七、CI（GitHub Actions）

每次向 `main` / `master` 分支 **push** 或发起 **pull request** 时，会自动运行：

- **Backend**：安装依赖（uv）、仅运行带 `@pytest.mark.unit` 的单元测试  
- **Frontend**：`npm ci`、`npm run lint`、`npm run build`  

配置见 `.github/workflows/ci.yml`。

## 八、相关文件

- `Dockerfile.deploy`：部署镜像构建文件  
- `docker-compose.deploy.yml`：服务器部署用 compose  
- `deploy/nginx.conf`：Nginx 配置（/ 静态，/ws 反代）  
- `deploy/start.sh`：容器启动脚本（先起后端再起 Nginx）  
- `.github/workflows/ci.yml`：Push/PR 时的 CI 流程  
- [DOCKER.md](DOCKER.md)：开发与本地 Docker 用法
