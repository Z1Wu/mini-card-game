#!/usr/bin/env python3
"""Select and hold a free local-development port slot for this worktree."""

import fcntl
import hashlib
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
from typing import Optional, Tuple


SLOT_COUNT = 1000
LOCK_DIRECTORY = Path(tempfile.gettempdir()) / "mini-card-game-worktree-ports"


def ports_for(slot: int) -> Tuple[int, int, int]:
    return 8765 + slot * 2, 8766 + slot * 2, 3000 + slot


def ports_are_free(slot: int) -> bool:
    for port in ports_for(slot):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
            try:
                listener.bind(("0.0.0.0", port))
            except OSError:
                return False
    return True


def try_lock(slot: int):
    LOCK_DIRECTORY.mkdir(parents=True, exist_ok=True)
    lock_file = (LOCK_DIRECTORY / f"slot-{slot}.lock").open("a+")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        lock_file.close()
        return None
    return lock_file


def worktree_seed() -> int:
    root = subprocess.check_output(
        ["git", "rev-parse", "--show-toplevel"], text=True
    ).strip()
    digest = hashlib.sha256(root.encode()).digest()
    return int.from_bytes(digest[:4], "big") % SLOT_COUNT


def acquire_slot(requested_slot: Optional[int]):
    seed = requested_slot if requested_slot is not None else worktree_seed()
    candidates = [seed] if requested_slot is not None else [
        (seed + offset) % SLOT_COUNT for offset in range(SLOT_COUNT)
    ]
    for slot in candidates:
        lock_file = try_lock(slot)
        if lock_file is None:
            continue
        if ports_are_free(slot):
            return slot, lock_file
        lock_file.close()
    if requested_slot is not None:
        raise RuntimeError(
            f"DEV_SLOT={requested_slot} is already in use or its ports are occupied. "
            "Run `make worktree` to select another slot automatically."
        )
    raise RuntimeError("No free local-development port slot found (checked 0–999).")


def main() -> int:
    override = os.environ.get("DEV_SLOT_OVERRIDE", "").strip()
    if override:
        try:
            requested_slot = int(override)
        except ValueError as error:
            raise RuntimeError("DEV_SLOT must be an integer from 0 to 999.") from error
        if not 0 <= requested_slot < SLOT_COUNT:
            raise RuntimeError("DEV_SLOT must be an integer from 0 to 999.")
    else:
        requested_slot = None

    slot, lock_file = acquire_slot(requested_slot)
    backend_port, admin_port, frontend_port = ports_for(slot)
    print(
        f"Worktree port slot {slot}: frontend http://localhost:{frontend_port}, "
        f"backend ws://localhost:{backend_port}, admin http://localhost:{admin_port}",
        flush=True,
    )
    try:
        return subprocess.call(["make", "dev-on-slot", f"DEV_SLOT={slot}"])
    except KeyboardInterrupt:
        return 130
    finally:
        lock_file.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"worktree dev: {error}", file=sys.stderr)
        raise SystemExit(1)
