#!/bin/bash
set -e
cd "$(dirname "$0")"
docker compose -f docker-compose.deploy.yml build
docker compose -f docker-compose.deploy.yml up -d
