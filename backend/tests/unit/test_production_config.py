import json

import pytest

import main as application
from auth.passwords import hash_password
from config import Config, ProductionConfigurationError


@pytest.fixture(autouse=True)
def restore_config(monkeypatch):
    original_environment = Config.APP_ENV
    yield
    monkeypatch.delenv("AUTH_USERS_FILE", raising=False)
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    Config.APP_ENV = original_environment


def write_users_file(tmp_path, users):
    users_file = tmp_path / "users.json"
    users_file.write_text(json.dumps(users), encoding="utf-8")
    return users_file


@pytest.mark.unit
def test_development_allows_demo_defaults(monkeypatch):
    Config.APP_ENV = "development"
    monkeypatch.delenv("AUTH_USERS_FILE", raising=False)
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)

    Config.validate_startup_configuration()


@pytest.mark.unit
def test_production_requires_explicit_users_file(monkeypatch):
    Config.APP_ENV = "production"
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://cards.example.com")
    monkeypatch.delenv("AUTH_USERS_FILE", raising=False)

    with pytest.raises(ProductionConfigurationError, match="AUTH_USERS_FILE must be explicitly set"):
        Config.validate_startup_configuration()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_main_fails_before_starting_with_missing_production_configuration(monkeypatch):
    Config.APP_ENV = "production"
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://cards.example.com")
    monkeypatch.delenv("AUTH_USERS_FILE", raising=False)

    with pytest.raises(ProductionConfigurationError, match="AUTH_USERS_FILE must be explicitly set"):
        await application.main()


@pytest.mark.unit
def test_production_rejects_plaintext_or_default_users(monkeypatch, tmp_path):
    Config.APP_ENV = "production"
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://cards.example.com")
    users_file = write_users_file(tmp_path, [{"username": "admin", "password": "not-safe"}])
    monkeypatch.setenv("AUTH_USERS_FILE", str(users_file))

    with pytest.raises(ProductionConfigurationError, match="password_hash"):
        Config.validate_startup_configuration()


@pytest.mark.unit
def test_production_rejects_password_hash_placeholders(monkeypatch, tmp_path):
    Config.APP_ENV = "production"
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://cards.example.com")
    users_file = write_users_file(tmp_path, [{"username": "admin", "password_hash": "generate-one"}])
    monkeypatch.setenv("AUTH_USERS_FILE", str(users_file))

    with pytest.raises(ProductionConfigurationError, match="PBKDF2"):
        Config.validate_startup_configuration()


@pytest.mark.unit
@pytest.mark.parametrize("origins", ["", "*", "https://cards.example.com/path", "ftp://cards.example.com"])
def test_production_requires_explicit_concrete_origins(monkeypatch, tmp_path, origins):
    Config.APP_ENV = "production"
    users_file = write_users_file(
        tmp_path, [{"username": "admin", "password_hash": "pbkdf2_sha256$1$c2FsdA==$ZGlnZXN0"}]
    )
    monkeypatch.setenv("AUTH_USERS_FILE", str(users_file))
    monkeypatch.setenv("ALLOWED_ORIGINS", origins)

    with pytest.raises(ProductionConfigurationError, match="ALLOWED_ORIGINS"):
        Config.validate_startup_configuration()


@pytest.mark.unit
def test_production_accepts_hashed_users_and_explicit_origins(monkeypatch, tmp_path):
    Config.APP_ENV = "production"
    users_file = write_users_file(
        tmp_path, [{"username": "admin", "password_hash": "pbkdf2_sha256$1$c2FsdA==$ZGlnZXN0"}]
    )
    monkeypatch.setenv("AUTH_USERS_FILE", str(users_file))
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://cards.example.com,http://localhost:5173")

    Config.validate_startup_configuration()


@pytest.mark.unit
def test_production_accepts_urlsafe_password_hashes(monkeypatch, tmp_path):
    Config.APP_ENV = "production"
    password_hash = hash_password("safe-password", iterations=1_000, salt=b"\xfb\xff\xff\xfb")
    assert "-" in password_hash or "_" in password_hash
    users_file = write_users_file(
        tmp_path, [{"username": "admin", "password_hash": password_hash}]
    )
    monkeypatch.setenv("AUTH_USERS_FILE", str(users_file))
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://cards.example.com")

    Config.validate_startup_configuration()
