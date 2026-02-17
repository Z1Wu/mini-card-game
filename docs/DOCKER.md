jia# Docker 部署指南

## 前置要求

- Docker 20.10+
- Docker Compose 2.0+

## 快速开始

### 1. 构建镜像

```bash
./docker.sh build
```

或使用 docker-compose：

```bash
docker-compose build
```

**注意**：Dockerfile 使用 uv 管理依赖，构建时会自动安装 uv 并同步依赖。

### 2. 启动服务

```bash
./docker.sh start
```

或使用 docker-compose：

```bash
docker-compose up -d
```

服务将在 `ws://localhost:8765` 启动。

### 3. 查看日志

```bash
./docker.sh logs
```

或使用 docker-compose：

```bash
docker-compose logs -f backend
```

### 4. 停止服务

```bash
./docker.sh stop
```

或使用 docker-compose：

```bash
docker-compose down
```

## 运行测试

### 运行基础测试

```bash
./docker.sh test
```

或使用 docker-compose：

```bash
docker-compose run --rm test
```

### 进入容器 Shell

```bash
./docker.sh shell
```

或使用 docker-compose：

```bash
docker-compose run --rm backend /bin/bash
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `./docker.sh build` | 构建 Docker 镜像 |
| `./docker.sh start` | 启动后端服务 |
| `./docker.sh stop` | 停止后端服务 |
| `./docker.sh restart` | 重启后端服务 |
| `./docker.sh logs` | 查看后端服务日志 |
| `./docker.sh test` | 运行测试 |
| `./docker.sh shell` | 进入容器 shell |
| `./docker.sh clean` | 清理 Docker 资源 |

## 服务端口

- WebSocket 服务: `8765`

## 环境变量

可以在 `docker-compose.yml` 中配置以下环境变量：

```yaml
environment:
  - HOST=0.0.0.0
  - PORT=8765
```

## 数据持久化

当前配置使用卷挂载，代码修改会自动同步到容器：

```yaml
volumes:
  - ./backend:/app
```

## uv 在 Docker 中的使用

### Dockerfile 中的 uv 配置

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# 安装 uv
RUN pip install --no-cache-dir uv

# 复制项目配置
COPY backend/pyproject.toml .

# 使用 uv 同步依赖
RUN uv sync --frozen

# 复制代码
COPY backend/ .

EXPOSE 8765

# 使用 uv 运行服务
CMD ["uv", "run", "python", "main.py"]
```

### uv 的优势

- **快速安装**：比 pip 快 10-100 倍
- **并行下载**：充分利用网络带宽
- **智能缓存**：避免重复下载
- **依赖解析**：快速解析依赖关系

### 构建优化

如果需要优化构建速度，可以使用 Docker 缓存：

```dockerfile
# 只在 pyproject.toml 变化时重新同步依赖
COPY backend/pyproject.toml .
RUN uv sync --frozen

# 代码变化时不需要重新安装依赖
COPY backend/ .
```

## 故障排查

### 查看容器状态

```bash
docker ps -a
```

### 查看容器日志

```bash
docker logs card_game_backend
```

### 重启容器

```bash
docker restart card_game_backend
```

### 清理所有资源

```bash
./docker.sh clean
```

### uv 相关问题

#### 依赖安装失败

```bash
# 重新构建镜像
docker-compose build --no-cache
```

#### uv 命令未找到

```bash
# 检查 Dockerfile 中是否正确安装了 uv
docker-compose build --no-cache
```

## 测试 WebSocket 连接

可以使用以下方法测试 WebSocket 连接：

### 方法 1: 使用 wscat

```bash
npm install -g wscat
wscat -c ws://localhost:8765
```

发送测试消息：

```json
{"type": "join_game", "player_id": "test_1", "player_name": "测试玩家1"}
```

### 方法 2: 使用 Python 测试客户端

```bash
docker-compose run --rm backend python tests/test_game_flow.py
```

### 方法 3: 使用浏览器控制台

```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
    console.log('已连接');
    ws.send(JSON.stringify({
        type: 'join_game',
        player_id: 'browser_test',
        player_name: '浏览器测试'
    }));
};

ws.onmessage = (event) => {
    console.log('收到消息:', JSON.parse(event.data));
};
```

## 生产环境部署

### 修改端口

编辑 `docker-compose.yml`：

```yaml
ports:
  - "8080:8765"  # 将外部端口改为 8080
```

### 使用环境变量文件

创建 `.env` 文件：

```env
HOST=0.0.0.0
PORT=8765
```

修改 `docker-compose.yml`：

```yaml
services:
  backend:
    env_file:
      - .env
```

### 使用 Docker 直接运行

```bash
docker build -t card-game-backend .
docker run -d -p 8765:8765 --name card-game-backend card-game-backend
```

### 使用多阶段构建优化镜像大小

```dockerfile
FROM python:3.10-slim as builder
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY backend/pyproject.toml .
RUN uv sync --frozen

FROM python:3.10-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY --from=builder /app/.venv /app/.venv
COPY backend/ .
ENV PATH=/app/.venv/bin:$PATH
CMD ["uv", "run", "python", "main.py"]
```

### 使用 Alpine Linux

```dockerfile
FROM python:3.10-alpine
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY backend/pyproject.toml .
RUN uv sync --frozen
COPY backend/ .
EXPOSE 8765
CMD ["uv", "run", "python", "main.py"]
```

## 监控和日志

### 查看资源使用

```bash
docker stats card_game_backend
```

### 查看详细日志

```bash
docker logs --tail 100 -f card_game_backend
```

### 配置日志级别

在 `backend/config.py` 中配置：

```python
import logging

logging.basicConfig(level=logging.INFO)
```

## 安全建议

1. 不要在生产环境中暴露管理端口
2. 使用环境变量管理敏感信息
3. 定期更新基础镜像
4. 使用非 root 用户运行容器

```dockerfile
FROM python:3.10-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY backend/pyproject.toml .
RUN uv sync --frozen
COPY backend/ .
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8765
CMD ["uv", "run", "python", "main.py"]
```

## 故障恢复

### 备份数据

```bash
docker exec card_game_backend tar -czf /tmp/backup.tar.gz /app
docker cp card_game_backend:/tmp/backup.tar.gz ./backup.tar.gz
```

### 恢复数据

```bash
docker cp ./backup.tar.gz card_game_backend:/tmp/backup.tar.gz
docker exec card_game_backend tar -xzf /tmp/backup.tar.gz -C /
```

## 更新服务

```bash
./docker.sh stop
./docker.sh build
./docker.sh start
```

或使用一条命令：

```bash
docker-compose up -d --build backend
```

## 性能优化

### 使用 uv 缓存

```dockerfile
# 创建 uv 缓存目录
RUN mkdir -p /root/.cache/uv

# 设置缓存目录
ENV UV_CACHE_DIR=/root/.cache/uv
```

### 优化构建缓存

```dockerfile
# 分层构建，利用 Docker 缓存
COPY backend/pyproject.toml .
RUN uv sync --frozen

COPY backend/ .
```

### 使用多阶段构建

见上文"生产环境部署"部分。

## 本地开发与 Docker

### 使用 uv 本地开发

```bash
# 进入 backend 目录
cd backend

# 安装 uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# 同步依赖
uv sync

# 运行服务
uv run python main.py
```

### 使用 Docker 开发

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 进入容器调试
docker-compose run --rm backend /bin/bash
```

### 混合模式

本地使用 uv 开发，Docker 用于测试和部署：

```bash
# 本地开发
cd backend
uv run python main.py

# Docker 测试
docker-compose run --rm test
```

## 常见问题

### Q: 为什么使用 uv 而不是 pip？

A: uv 比 pip 快 10-100 倍，支持并行下载，有更好的缓存机制。

### Q: Docker 构建时 uv 安装失败怎么办？

A: 清理 Docker 缓存并重新构建：

```bash
docker-compose build --no-cache
```

### Q: 如何在容器中使用 uv 命令？

A: 进入容器后可以直接使用 uv：

```bash
docker-compose run --rm backend /bin/bash
uv pip list
```

### Q: 如何更新依赖？

A: 更新 `backend/pyproject.toml` 后重新构建：

```bash
docker-compose build --no-cache backend
docker-compose up -d backend
```

## 相关文档

- [项目主文档](../README.md)
- [后端实现方案](backend_implementation.md)
- [后端测试方案](backend_testing.md)
- [uv 官方文档](https://github.com/astral-sh/uv)
