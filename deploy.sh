#!/bin/sh
set -eu

cd "$(dirname "$0")"

docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d --remove-orphans
