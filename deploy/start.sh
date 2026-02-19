#!/bin/sh
set -e
cd /app/backend && uv run python main.py &
exec nginx -g 'daemon off;'
