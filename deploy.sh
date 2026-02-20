#!/bin/bash
set -e
cd "$(dirname "$0")"
# docker compose -f docker-compose.deploy.yml build   # 需要重建镜像时取消注释
docker compose -f docker-compose.deploy.yml down
# 删除可能存在的同名容器（例如之前用 docker run 起的），保证 up 幂等
docker rm -f card-game 2>/dev/null || true
docker compose -f docker-compose.deploy.yml up -d
