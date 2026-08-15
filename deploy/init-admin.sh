#!/usr/bin/env bash
# Bootstrap the initial admin account inside the running production container.
#
# Prerequisites:
#   - The card-game container must be running (started via deploy.sh).
#   - deploy-data/users.json must be mounted at /app/config/users.json.
#
# Usage:
#   ./deploy/init-admin.sh <username> <password> [display-name]
#
# Example:
#   ./deploy/init-admin.sh admin "S3cur3P@ss!" "超级管理员"
#
# The command hashes the password with PBKDF2 and writes the admin entry to
# the mounted users.json on the host.  Restart or reload is not required —
# the backend reads the file on the next login attempt.
set -euo pipefail

CONTAINER=${CONTAINER_NAME:-card-game}

if [[ $# -lt 2 || $# -gt 3 ]]; then
  echo "Usage: $0 <username> <password> [display-name]" >&2
  echo "" >&2
  echo "Create the initial admin account in the running container's users.json." >&2
  echo "" >&2
  echo "Examples:" >&2
  echo "  $0 admin 'strong-password'" >&2
  echo "  $0 admin 'strong-password' '超级管理员'" >&2
  exit 2
fi

username=$1
password=$2
name=${3:-$username}

# Verify the container is running
if ! docker container inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Error: container '$CONTAINER' not found. Run deploy.sh first." >&2
  exit 1
fi

echo "Bootstrapping admin '$username' inside container '$CONTAINER'..."
# Pipe the password via stdin so it never appears in the container's process list.
printf '%s' "$password" | docker exec -i "$CONTAINER" sh -c \
  "cd /app/backend && uv run python -m auth.bootstrap '$username' - --name '$name' --users-file /app/config/users.json"

echo ""
echo "Admin '$username' created successfully."
echo "You can now log in at https://<your-domain>/ with these credentials."
