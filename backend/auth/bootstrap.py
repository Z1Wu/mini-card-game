"""CLI tool to bootstrap the initial admin account.

Usage::

    python -m auth.bootstrap <username> <password> [--name NAME]

Creates (or updates) an admin user in the AUTH_USERS_FILE.  The password is
always stored as a PBKDF2 hash — plaintext ``password`` fields are never written.

If the file does not exist yet it will be created with just this one admin
entry, which is handy for first-time production deployments.
"""

import argparse
import json
import logging
import os
import sys

from auth.passwords import hash_password

logger = logging.getLogger(__name__)


def _resolve_users_file() -> str:
    """Return the path to the users file, respecting the AUTH_USERS_FILE env var."""
    from config import Config
    return Config.AUTH_USERS_FILE


def _load_existing(path: str) -> list[dict]:
    """Load existing users from the JSON file, returning an empty list when missing."""
    if not os.path.isfile(path):
        return []
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Could not read %s (%s); starting fresh.", path, exc)
    return []


def bootstrap_admin(
    username: str,
    password: str,
    name: str | None = None,
    users_file: str | None = None,
) -> str:
    """Create or update an admin user.

    Returns the path of the users file that was written.
    """
    if not username or not username.strip():
        raise ValueError("username must not be empty")
    if not password:
        raise ValueError("password must not be empty")

    username = username.strip()
    display_name = name or username
    path = users_file or _resolve_users_file()

    users = _load_existing(path)

    hashed = hash_password(password)
    new_entry = {
        "username": username,
        "password_hash": hashed,
        "name": display_name,
        "role": "admin",
    }

    # Update in place if the username already exists; otherwise append.
    replaced = False
    for i, user in enumerate(users):
        if isinstance(user, dict) and user.get("username") == username:
            # Migrate: drop plaintext password field when upgrading to hash.
            user.pop("password", None)
            users[i] = new_entry
            replaced = True
            break
    if not replaced:
        users.append(new_entry)

    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)
        f.write("\n")

    action = "Updated" if replaced else "Created"
    logger.info("%s admin user '%s' in %s", action, username, path)
    return path


def _read_password(raw: str) -> str:
    """Resolve the password argument.

    ``-`` means *read from stdin* (one line, stripped of the trailing newline),
    which avoids putting the password on the command line where it would be
    visible in ``ps`` output.
    """
    if raw == "-":
        import sys
        return sys.stdin.readline().rstrip("\n")
    return raw


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="python -m auth.bootstrap",
        description="Bootstrap the initial admin account in users.json.",
    )
    parser.add_argument("username", help="Admin username")
    parser.add_argument(
        "password",
        help="Admin password (will be hashed). Pass '-' to read from stdin.",
    )
    parser.add_argument("--name", default=None, help="Display name (defaults to username)")
    parser.add_argument(
        "--users-file",
        default=None,
        help="Path to users JSON file (defaults to AUTH_USERS_FILE from config)",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    try:
        password = _read_password(args.password)
        path = bootstrap_admin(args.username, password, args.name, args.users_file)
        print(f"Admin '{args.username}' written to {path}")
    except (ValueError, OSError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
