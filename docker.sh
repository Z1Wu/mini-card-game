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
  init-admin)
    if [[ $# -lt 3 ]]; then
      echo "用法: $0 init-admin <username> <password> [display-name]"
      echo "在 users.json 中创建初始管理员账号（密码自动 hash）"
      exit 1
    fi
    username=$2
    password=$3
    name=${4:-$username}
    echo "创建管理员: $username ($name)..."
    docker-compose run --rm backend uv run python -m auth.bootstrap "$username" "$password" --name "$name"
    echo "管理员 $username 已创建，可用于登录管理界面"
    ;;
  *)
    echo "用法: $0 {build|start|stop|restart|logs|test|shell|clean|init-admin}"
    echo ""
    echo "命令说明:"
    echo "  build      - 构建 Docker 镜像"
    echo "  start      - 启动后端服务"
    echo "  stop       - 停止后端服务"
    echo "  restart    - 重启后端服务"
    echo "  logs       - 查看后端服务日志"
    echo "  test       - 运行测试"
    echo "  shell      - 进入容器 shell"
    echo "  clean      - 清理 Docker 资源"
    echo "  init-admin - 创建初始管理员账号"
    exit 1
    ;;
esac
