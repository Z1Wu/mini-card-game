# 本地 Docker 指南

本文件覆盖本地后端容器开发。服务器的发布镜像、Nginx 和 Compose 部署请使用 [部署指南](DEPLOY.md)。

## 前置条件

- Docker 20.10+
- Docker Compose v2

## 启动本地后端

```bash
docker compose up -d backend
docker compose logs -f backend
```

后端默认监听 `ws://localhost:8765`。停止服务：

```bash
docker compose down
```

`docker-compose.yml` 用于本地开发；它不是发布镜像的 Compose 文件。

## 本地构建与测试

```bash
docker compose build
docker compose run --rm test
```

也可使用仓库的辅助脚本：

```bash
./docker.sh build
./docker.sh start
./docker.sh logs
./docker.sh test
```

容器内用户配置遵循 `AUTH_USERS_FILE`；默认位置为 `backend/auth/users.json`。演示账号不能用于公网环境。密码哈希、Origin 限制和挂载生产用户文件的配置见 [部署指南](DEPLOY.md)。

## 发布镜像的本地试运行

```bash
docker build -f Dockerfile.deploy -t card-game:local .
docker run --rm -p 8080:80 --name card-game card-game:local
```

访问 `http://localhost:8080`。Nginx 将同源 `/ws` 代理到容器内的后端；发布镜像不直接暴露 8765。
