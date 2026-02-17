#!/bin/bash

echo "=== 卡牌游戏后端 Docker 部署脚本 ==="

case "$1" in
  build)
    echo "构建 Docker 镜像..."
    docker-compose build
    ;;
  start)
    echo "启动后端服务..."
    docker-compose up -d backend
    echo "后端服务已启动，监听端口 8765"
    ;;
  stop)
    echo "停止后端服务..."
    docker-compose down
    ;;
  restart)
    echo "重启后端服务..."
    docker-compose restart backend
    ;;
  logs)
    echo "查看后端服务日志..."
    docker-compose logs -f backend
    ;;
  test)
    echo "运行测试..."
    docker-compose run --rm test
    ;;
  shell)
    echo "进入容器 shell..."
    docker-compose run --rm backend /bin/bash
    ;;
  clean)
    echo "清理 Docker 资源..."
    docker-compose down -v
    docker system prune -f
    ;;
  *)
    echo "用法: $0 {build|start|stop|restart|logs|test|shell|clean}"
    echo ""
    echo "命令说明:"
    echo "  build   - 构建 Docker 镜像"
    echo "  start   - 启动后端服务"
    echo "  stop    - 停止后端服务"
    echo "  restart - 重启后端服务"
    echo "  logs    - 查看后端服务日志"
    echo "  test    - 运行测试"
    echo "  shell   - 进入容器 shell"
    echo "  clean   - 清理 Docker 资源"
    exit 1
    ;;
esac
