import pytest

from auth.passwords import hash_password, verify_password


@pytest.mark.unit
def test_password_hash_round_trip_and_wrong_password():
    encoded = hash_password("correct horse battery staple", iterations=1_000, salt=b"0123456789abcdef")

    assert encoded.startswith("pbkdf2_sha256$1000$")
    assert verify_password("correct horse battery staple", encoded)
    assert not verify_password("wrong", encoded)


@pytest.mark.unit
@pytest.mark.parametrize("encoded", ["", "plaintext", "pbkdf2_sha256$bad$salt$digest", "unknown$1$c2FsdA==$ZGlnZXN0"])
def test_malformed_password_hash_is_rejected(encoded):
    assert not verify_password("password", encoded)
