"""Unit tests for the AdminSessionManager."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from admin.sessions import AdminSessionManager


@pytest.mark.unit
def test_create_and_validate_session():
    mgr = AdminSessionManager(ttl_seconds=60)
    token = mgr.create_session("admin1")
    assert token
    assert token != mgr.create_session("admin1")  # unique tokens
    assert mgr.validate_session(token) == "admin1"


@pytest.mark.unit
def test_validate_invalid_token():
    mgr = AdminSessionManager(ttl_seconds=60)
    assert mgr.validate_session("nonexistent") is None
    assert mgr.validate_session("") is None


@pytest.mark.unit
def test_revoke_session():
    mgr = AdminSessionManager(ttl_seconds=60)
    token = mgr.create_session("admin1")
    mgr.revoke_session(token)
    assert mgr.validate_session(token) is None


@pytest.mark.unit
def test_revoke_nonexistent_token_is_noop():
    mgr = AdminSessionManager(ttl_seconds=60)
    mgr.revoke_session("does-not-exist")  # should not raise


@pytest.mark.unit
def test_expired_session_is_invalid():
    mgr = AdminSessionManager(ttl_seconds=60)
    token = mgr.create_session("admin1")
    # Simulate expiry by moving the created timestamp to the distant past
    username, _ = mgr._sessions[token]
    mgr._sessions[token] = (username, 0)
    assert mgr.validate_session(token) is None


@pytest.mark.unit
def test_cleanup_expired_removes_only_expired():
    mgr = AdminSessionManager(ttl_seconds=3600)
    live_token = mgr.create_session("admin1")
    expired_token = mgr.create_session("admin2")
    # Force expiry
    username, _ = mgr._sessions[expired_token]
    mgr._sessions[expired_token] = (username, 0)

    removed = mgr.cleanup_expired()
    assert removed == 1
    assert mgr.validate_session(live_token) == "admin1"
    assert mgr.validate_session(expired_token) is None


@pytest.mark.unit
def test_cleanup_expired_with_no_sessions():
    mgr = AdminSessionManager(ttl_seconds=3600)
    assert mgr.cleanup_expired() == 0
