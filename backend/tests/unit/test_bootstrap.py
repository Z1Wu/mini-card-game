"""Tests for auth.bootstrap — initial admin creation CLI."""

import json
import os
import tempfile

import pytest

from auth.bootstrap import bootstrap_admin


@pytest.fixture
def tmp_users_file(tmp_path):
    """Return a path to a temporary users JSON file that does not yet exist."""
    return str(tmp_path / "users.json")


class TestBootstrapAdmin:
    """Core bootstrap behaviour."""

    def test_creates_file_and_admin(self, tmp_users_file):
        path = bootstrap_admin("root", "s3cret", name="Root Admin", users_file=tmp_users_file)
        assert path == tmp_users_file
        assert os.path.isfile(tmp_users_file)

        with open(tmp_users_file, encoding="utf-8") as f:
            users = json.load(f)

        assert len(users) == 1
        admin = users[0]
        assert admin["username"] == "root"
        assert admin["name"] == "Root Admin"
        assert admin["role"] == "admin"
        assert "password" not in admin  # never plaintext
        assert admin["password_hash"].startswith("pbkdf2_sha256$")

    def test_password_is_verifiable(self, tmp_users_file):
        bootstrap_admin("admin", "hunter2", users_file=tmp_users_file)
        with open(tmp_users_file, encoding="utf-8") as f:
            users = json.load(f)
        admin = users[0]

        from auth.passwords import verify_password
        assert verify_password("hunter2", admin["password_hash"])
        assert not verify_password("wrong", admin["password_hash"])

    def test_appends_to_existing_users(self, tmp_users_file):
        # Pre-populate with a player
        with open(tmp_users_file, "w", encoding="utf-8") as f:
            json.dump(
                [{"username": "player1", "password_hash": "x", "name": "P1", "role": "player"}],
                f,
            )
        bootstrap_admin("boss", "pw", name="Boss", users_file=tmp_users_file)

        with open(tmp_users_file, encoding="utf-8") as f:
            users = json.load(f)
        assert len(users) == 2
        assert users[0]["username"] == "player1"
        assert users[1]["username"] == "boss"
        assert users[1]["role"] == "admin"

    def test_updates_existing_username(self, tmp_users_file):
        # First bootstrap
        bootstrap_admin("root", "old_pw", name="Old Name", users_file=tmp_users_file)
        # Second bootstrap with same username — should replace
        bootstrap_admin("root", "new_pw", name="New Name", users_file=tmp_users_file)

        with open(tmp_users_file, encoding="utf-8") as f:
            users = json.load(f)
        assert len(users) == 1
        assert users[0]["name"] == "New Name"

        from auth.passwords import verify_password
        assert verify_password("new_pw", users[0]["password_hash"])
        assert not verify_password("old_pw", users[0]["password_hash"])

    def test_migrates_plaintext_to_hash(self, tmp_users_file):
        # Simulate legacy entry with plaintext password
        with open(tmp_users_file, "w", encoding="utf-8") as f:
            json.dump(
                [{"username": "admin1", "password": "plain", "name": "Admin", "role": "admin"}],
                f,
            )
        bootstrap_admin("admin1", "hashed_now", users_file=tmp_users_file)

        with open(tmp_users_file, encoding="utf-8") as f:
            users = json.load(f)
        assert len(users) == 1
        assert "password" not in users[0]
        assert users[0]["password_hash"].startswith("pbkdf2_sha256$")

    def test_name_defaults_to_username(self, tmp_users_file):
        bootstrap_admin("superadmin", "pw", users_file=tmp_users_file)
        with open(tmp_users_file, encoding="utf-8") as f:
            users = json.load(f)
        assert users[0]["name"] == "superadmin"

    def test_rejects_empty_username(self, tmp_users_file):
        with pytest.raises(ValueError, match="username"):
            bootstrap_admin("", "pw", users_file=tmp_users_file)

    def test_rejects_empty_password(self, tmp_users_file):
        with pytest.raises(ValueError, match="password"):
            bootstrap_admin("admin", "", users_file=tmp_users_file)

    def test_creates_parent_directories(self, tmp_path):
        nested = str(tmp_path / "deep" / "dir" / "users.json")
        bootstrap_admin("admin", "pw", users_file=nested)
        assert os.path.isfile(nested)
