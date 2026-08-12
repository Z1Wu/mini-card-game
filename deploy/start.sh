#!/bin/sh
set -e
cd /app/backend

# Run production validation in the foreground so an unsafe configuration stops
# the container before either the backend or Nginx can serve traffic.
uv run python -c "from config import Config; Config.validate_startup_configuration()"

uv run python main.py &
exec nginx -g 'daemon off;'
