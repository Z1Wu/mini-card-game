#!/usr/bin/env bash
# Deploy a published card-game image from this machine to the production host.
#
# The SSH key stays on the operator's machine.  The target host only needs
# Docker and permission for the selected SSH user to run Docker commands.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy-remote.sh <version-tag> [deploy-host]

Example:
  ./scripts/deploy-remote.sh v1.1.1
  ./scripts/deploy-remote.sh v1.1.1 tx_cloud

Optional environment variables:
  CARD_GAME_IMAGE   Docker image repository (default: z1wu97/mini-card-game)
  CONTAINER_NAME    Container name (default: card-game)
  DEPLOY_NETWORK    Docker network mode (default: host; matches production)
  HEALTHCHECK_URL   URL checked on the remote host (default: http://127.0.0.1/)
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage >&2
  exit 2
fi

tag=$1
deploy_host=${2:-tc_cloud_2026_vm}
image=${CARD_GAME_IMAGE:-z1wu97/mini-card-game}
container=${CONTAINER_NAME:-card-game}
network=${DEPLOY_NETWORK:-host}
healthcheck_url=${HEALTHCHECK_URL:-http://127.0.0.1/}

# Keep user-provided values as data, not shell syntax passed to the remote host.
[[ $tag =~ ^v[0-9]+(\.[0-9]+){1,3}([-.][0-9A-Za-z]+)*$ ]] || {
  echo "Invalid version tag: $tag (expected e.g. v1.1.1)" >&2
  exit 2
}
[[ $container =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || {
  echo "Invalid container name: $container" >&2
  exit 2
}
[[ $network =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || {
  echo "Invalid Docker network mode: $network" >&2
  exit 2
}
[[ $image =~ ^[a-z0-9][a-z0-9._/-]*$ ]] || {
  echo "Invalid Docker image name: $image" >&2
  exit 2
}

printf 'Deploying %s:%s to %s as %s (network: %s)\n' \
  "$image" "$tag" "$deploy_host" "$container" "$network"

ssh -o BatchMode=yes -o ConnectTimeout=10 "$deploy_host" bash -s -- \
  "$image" "$tag" "$container" "$network" "$healthcheck_url" <<'REMOTE_SCRIPT'
set -euo pipefail

image=$1
tag=$2
container=$3
network=$4
healthcheck_url=$5
new_image="${image}:${tag}"
previous_image=""

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or is not available to this SSH user." >&2
  exit 1
fi

if docker container inspect "$container" >/dev/null 2>&1; then
  previous_image=$(docker container inspect --format '{{.Config.Image}}' "$container")
fi

echo "Pulling ${new_image}..."
docker pull "$new_image"

start_container() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker run -d \
    --name "$container" \
    --network "$network" \
    --restart unless-stopped \
    "$1" >/dev/null
}

is_healthy() {
  for _ in $(seq 1 15); do
    if curl -fsS --max-time 3 "$healthcheck_url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

echo "Starting ${new_image}..."
start_container "$new_image"

if is_healthy; then
  echo "Deployment succeeded: ${new_image}"
  docker ps --filter "name=^/${container}$" --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
  exit 0
fi

echo "Health check failed for ${new_image}." >&2
docker logs --tail 100 "$container" >&2 || true

if [[ -n $previous_image ]]; then
  echo "Rolling back to ${previous_image}..." >&2
  start_container "$previous_image"
  if is_healthy; then
    echo "Rollback succeeded." >&2
  else
    echo "Rollback health check also failed; inspect the container immediately." >&2
  fi
else
  echo "No previous container image is available for rollback." >&2
fi
exit 1
REMOTE_SCRIPT
