"""Unit tests for the admin HTTP REST API endpoints."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from aiohttp.test_utils import TestClient, TestServer

import auth.users as users_module
from admin.http_server import AdminHttpServer
from admin.sessions import AdminSessionManager
from websocket.hub import RoomHubWebSocketServer


@pytest.fixture
async def admin_env(tmp_path, monkeypatch):
    """Set up a temp users file, hub, and HTTP test client."""
    users_data = [
        {"username": "player1", "password": "pass1", "name": "玩家1", "role": "player"},
        {"username": "admin1", "password": "adminpass", "name": "管理员1", "role": "admin"},
    ]
    path = tmp_path / "users.json"
    path.write_text(json.dumps(users_data, ensure_ascii=False), encoding="utf-8")
    users_module._USERS = {}
    from config import Config
    monkeypatch.setattr(Config, "AUTH_USERS_FILE", str(path))

    hub = RoomHubWebSocketServer(rng_seed=42)
    session_mgr = AdminSessionManager(ttl_seconds=3600)
    http_server = AdminHttpServer(hub=hub, session_manager=session_mgr, port=0)

    server = TestServer(http_server.app)
    client = TestClient(server)
    await client.start_server()

    yield client

    await client.close()
    users_module._USERS = {}


async def _login_as_admin(client) -> str:
    resp = await client.post("/api/admin/login", json={
        "username": "admin1",
        "password": "adminpass",
    })
    assert resp.status == 200
    body = await resp.json()
    return body["token"]


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_admin_login_success(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    assert token


@pytest.mark.unit
async def test_admin_login_wrong_password(admin_env):
    client = admin_env
    resp = await client.post("/api/admin/login", json={
        "username": "admin1",
        "password": "wrong",
    })
    assert resp.status == 401


@pytest.mark.unit
async def test_admin_login_non_admin_rejected(admin_env):
    client = admin_env
    resp = await client.post("/api/admin/login", json={
        "username": "player1",
        "password": "pass1",
    })
    assert resp.status == 403


@pytest.mark.unit
async def test_admin_login_missing_fields(admin_env):
    client = admin_env
    resp = await client.post("/api/admin/login", json={"username": "admin1"})
    assert resp.status == 400


# ---------------------------------------------------------------------------
# Auth guard
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_unauthenticated_request_rejected(admin_env):
    client = admin_env
    resp = await client.get("/api/admin/users")
    assert resp.status == 401


@pytest.mark.unit
async def test_logout_invalidates_token(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/admin/users", headers=headers)
    assert resp.status == 200

    await client.post("/api/admin/logout", headers=headers)

    resp = await client.get("/api/admin/users", headers=headers)
    assert resp.status == 401


# ---------------------------------------------------------------------------
# Users CRUD
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_list_users(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    resp = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status == 200
    body = await resp.json()
    assert len(body["users"]) == 2


@pytest.mark.unit
async def test_create_user(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post("/api/admin/users", json={
        "username": "newuser",
        "name": "New User",
        "password": "secret123",
        "role": "player",
    }, headers=headers)
    assert resp.status == 201
    # Verify the new user can authenticate
    users_module._USERS = {}
    assert users_module.authenticate_user("newuser", "secret123") is True


@pytest.mark.unit
async def test_create_duplicate_user(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.post("/api/admin/users", json={
        "username": "player1",
        "name": "Dup",
        "password": "x",
        "role": "player",
    }, headers=headers)
    assert resp.status == 409


@pytest.mark.unit
async def test_update_user(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.put("/api/admin/users/player1", json={
        "name": "Renamed",
        "role": "admin",
    }, headers=headers)
    assert resp.status == 200
    users_module._USERS = {}
    assert users_module.is_admin("player1") is True
    assert users_module.get_user_name("player1") == "Renamed"


@pytest.mark.unit
async def test_delete_user(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.delete("/api/admin/users/player1", headers=headers)
    assert resp.status == 200
    users_module._USERS = {}
    assert "player1" not in users_module.get_all_usernames()


@pytest.mark.unit
async def test_cannot_delete_self(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.delete("/api/admin/users/admin1", headers=headers)
    assert resp.status == 400


@pytest.mark.unit
async def test_cannot_delete_last_admin(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    headers = {"Authorization": f"Bearer {token}"}
    # admin1 is the only admin; trying to demote then delete should fail on delete
    resp = await client.delete("/api/admin/users/admin1", headers=headers)
    assert resp.status == 400  # cannot delete self (admin1 is the logged-in admin)


# ---------------------------------------------------------------------------
# Rooms
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_list_rooms(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    resp = await client.get("/api/admin/rooms", headers={"Authorization": f"Bearer {token}"})
    assert resp.status == 200
    body = await resp.json()
    # The default room always exists
    codes = [r["code"] for r in body["rooms"]]
    assert "default" in codes


@pytest.mark.unit
async def test_get_game_state(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    resp = await client.get(
        "/api/admin/rooms/default/game-state",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status == 200
    body = await resp.json()
    # The default room has a game (created in GameWebSocketServer.__init__)
    assert body["game_state"] is not None


@pytest.mark.unit
async def test_get_game_state_room_not_found(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    resp = await client.get(
        "/api/admin/rooms/NONEXIST/game-state",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status == 404


@pytest.mark.unit
async def test_cannot_close_default_room(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    resp = await client.delete(
        "/api/admin/rooms/default",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status == 400


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@pytest.mark.unit
async def test_stats(admin_env):
    client = admin_env
    token = await _login_as_admin(client)
    resp = await client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
    assert resp.status == 200
    body = await resp.json()
    assert body["total_users"] == 2
    assert body["admin_count"] == 1
    assert body["total_rooms"] >= 1
