#!/usr/bin/env bash
# Production deployment script.
#
# Usage:
#   ./deploy.sh                                          # pull & start
#   ./deploy.sh init-admin <username> <password> [name]  # deploy + create admin
#   IMAGE_TAG=v1.2.0 ./deploy.sh                        # deploy specific version
#
# Environment variables:
#   IMAGE_TAG         Docker image tag (default: latest)
#   CARD_GAME_IMAGE   Docker image repo  (default: z1wu97/mini-card-game)
#   CONTAINER_NAME    Container name     (default: card-game)
set -euo pipefail

cd "$(dirname "$0")"

container=${CONTAINER_NAME:-card-game}

deploy() {
  docker compose -f docker-compose.deploy.yml pull
  docker compose -f docker-compose.deploy.yml up -d --remove-orphans
}

init_admin() {
  local username=$1 password=$2 name=$3

  # Wait briefly for the container to be ready
  for _ in $(seq 1 10); do
    if docker exec "$container" true >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! docker container inspect "$container" >/dev/null 2>&1; then
    echo "Error: container '$container' is not running." >&2
    exit 1
  fi

  echo "Creating admin '$username'..."
  printf '%s' "$password" | docker exec -i "$container" sh -c \
    "cd /app/backend && uv run python -m auth.bootstrap '$username' - --name '$name' --users-file /app/config/users.json"

  echo ""
  echo "Admin '$username' created. Log in at your site to access the admin panel."
}

# --- Main ---

deploy

case "${1:-}" in
  init-admin)
    if [[ $# -lt 3 ]]; then
      echo "Usage: $0 init-admin <username> <password> [display-name]" >&2
      exit 2
    fi
    init_admin "$2" "$3" "${4:-$2}"
    ;;
  "")
    # Normal deploy only — already done above
    ;;
  *)
    echo "Unknown command: $1" >&2
    echo "Usage: $0 [init-admin <username> <password> [display-name]]" >&2
    exit 2
    ;;
esac
