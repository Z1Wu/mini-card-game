"""Unit tests for admin role parsing and user CRUD in auth.users."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

import auth.users as users_module


@pytest.fixture
def temp_users_file(tmp_path, monkeypatch):
    """Create a temporary users.json and reset the in-memory cache."""
    users_data = [
        {"username": "player1", "password": "pass1", "name": "玩家1", "role": "player"},
        {"username": "admin1", "password": "adminpass", "name": "管理员1", "role": "admin"},
    ]
    path = tmp_path / "users.json"
    path.write_text(json.dumps(users_data, ensure_ascii=False), encoding="utf-8")

    # Reset cache so _load_users reloads from the temp file
    users_module._USERS = {}
    from config import Config
    monkeypatch.setattr(Config, "AUTH_USERS_FILE", str(path))

    yield path

    users_module._USERS = {}


@pytest.mark.unit
def test_role_parsing_defaults_to_player(temp_users_file):
    users_module._USERS = {}
    users_module._load_users()
    assert users_module.get_user_role("player1") == "player"
    assert users_module.get_user_role("admin1") == "admin"


@pytest.mark.unit
def test_role_parsing_missing_role_defaults_to_player(tmp_path, monkeypatch):
    """Users without an explicit role field should default to 'player'."""
    users_data = [{"username": "someone", "password": "p", "name": "Someone"}]
    path = tmp_path / "users.json"
    path.write_text(json.dumps(users_data), encoding="utf-8")
    users_module._USERS = {}
    from config import Config
    monkeypatch.setattr(Config, "AUTH_USERS_FILE", str(path))

    assert users_module.get_user_role("someone") == "player"


@pytest.mark.unit
def test_is_admin(temp_users_file):
    users_module._USERS = {}
    assert users_module.is_admin("admin1") is True
    assert users_module.is_admin("player1") is False
    assert users_module.is_admin("nonexistent") is False


@pytest.mark.unit
def test_get_user_role_unknown_returns_empty(temp_users_file):
    users_module._USERS = {}
    assert users_module.get_user_role("ghost") == ""


@pytest.mark.unit
def test_get_all_users_excludes_passwords(temp_users_file):
    users_module._USERS = {}
    users = users_module.get_all_users()
    assert len(users) == 2
    for u in users:
        assert "password" not in u
        assert "password_hash" not in u
        assert "username" in u
        assert "name" in u
        assert "role" in u


@pytest.mark.unit
def test_create_user(temp_users_file):
    users_module._USERS = {}
    assert users_module.create_user("newuser", "New User", "secret123", "player") is True
    assert users_module.is_admin("newuser") is False
    assert users_module.get_user_role("newuser") == "player"
    # Password should be hashed, not stored in plaintext
    stored = users_module._USERS["newuser"]
    assert stored["password_hash"]
    assert not stored["password"]
    # Can authenticate with the new password
    assert users_module.authenticate_user("newuser", "secret123") is True


@pytest.mark.unit
def test_create_user_duplicate_fails(temp_users_file):
    users_module._USERS = {}
    assert users_module.create_user("player1", "Dup", "pw", "player") is False


@pytest.mark.unit
def test_create_user_admin_role(temp_users_file):
    users_module._USERS = {}
    users_module.create_user("admin2", "Admin 2", "pw", "admin")
    assert users_module.is_admin("admin2") is True


@pytest.mark.unit
def test_update_user_name_and_role(temp_users_file):
    users_module._USERS = {}
    assert users_module.update_user("player1", name="New Name", role="admin") is True
    assert users_module.get_user_name("player1") == "New Name"
    assert users_module.is_admin("player1") is True


@pytest.mark.unit
def test_update_user_password(temp_users_file):
    users_module._USERS = {}
    assert users_module.update_user("player1", password="newpass") is True
    assert users_module.authenticate_user("player1", "pass1") is False
    assert users_module.authenticate_user("player1", "newpass") is True


@pytest.mark.unit
def test_update_nonexistent_user_fails(temp_users_file):
    users_module._USERS = {}
    assert users_module.update_user("ghost", name="X") is False


@pytest.mark.unit
def test_delete_user(temp_users_file):
    users_module._USERS = {}
    assert users_module.delete_user("player1") is True
    assert users_module.get_user_role("player1") == ""
    # File should reflect the deletion
    users_module._USERS = {}
    users_module._load_users()
    assert "player1" not in users_module.get_all_usernames()


@pytest.mark.unit
def test_delete_nonexistent_user_fails(temp_users_file):
    users_module._USERS = {}
    assert users_module.delete_user("ghost") is False


@pytest.mark.unit
def test_admin_count(temp_users_file):
    users_module._USERS = {}
    assert users_module.admin_count() == 1
    users_module.create_user("admin2", "Admin 2", "pw", "admin")
    assert users_module.admin_count() == 2
