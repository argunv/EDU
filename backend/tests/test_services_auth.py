import uuid
import pytest
from sqlalchemy.orm import Session

from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    create_refresh_token,
    revoke_refresh_token,
    find_valid_refresh_token,
    rotate_refresh_token,
    revoke_all_refresh_tokens_for_user,
)
from app.models.user import User, RefreshToken
from app.models.class_model import Class


def test_hash_password():
    h = hash_password("secret")
    assert h != "secret"
    assert len(h) > 20


def test_verify_password():
    h = hash_password("mypass")
    assert verify_password("mypass", h) is True
    assert verify_password("wrong", h) is False


def test_verify_password_invalid_hash():
    assert verify_password("x", "not-bcrypt") is False


def test_create_access_token():
    token = create_access_token(str(uuid.uuid4()))
    assert isinstance(token, str)
    assert len(token) > 10


def test_decode_access_token_valid():
    user_id = str(uuid.uuid4())
    token = create_access_token(user_id)
    payload = decode_access_token(token)
    assert payload is not None
    assert payload.get("sub") == user_id
    assert payload.get("type") == "access"


def test_decode_access_token_invalid():
    assert decode_access_token("invalid") is None
    assert decode_access_token("") is None


def test_create_refresh_token(db: Session):
    cls = Class(id=uuid.uuid4(), name="1X", year_start=2024, grade=1, letter="X", shift="morning", archived=False)
    db.add(cls)
    db.flush()
    user = User(
        id=uuid.uuid4(),
        email="rt@test.com",
        password_hash=hash_password("x"),
        name="User",
        role="student",
    )
    db.add(user)
    db.flush()
    raw, ref = create_refresh_token(db, user.id)
    assert len(raw) > 20
    assert ref.user_id == user.id
    assert ref.revoked == "N"


def test_revoke_refresh_token(db: Session):
    cls = Class(id=uuid.uuid4(), name="2Y", year_start=2024, grade=2, letter="Y", shift="morning", archived=False)
    db.add(cls)
    db.flush()
    user = User(
        id=uuid.uuid4(),
        email="rev@test.com",
        password_hash=hash_password("x"),
        name="User",
        role="student",
    )
    db.add(user)
    db.flush()
    raw, ref = create_refresh_token(db, user.id)
    token_hash = ref.token_hash
    ok = revoke_refresh_token(db, token_hash)
    assert ok is True
    db.refresh(ref)
    assert ref.revoked == "Y"
    assert revoke_refresh_token(db, token_hash) is False


def test_find_valid_refresh_token(db: Session):
    cls = Class(id=uuid.uuid4(), name="3Z", year_start=2024, grade=3, letter="Z", shift="morning", archived=False)
    db.add(cls)
    db.flush()
    user = User(
        id=uuid.uuid4(),
        email="find@test.com",
        password_hash=hash_password("x"),
        name="User",
        role="student",
    )
    db.add(user)
    db.flush()
    raw, ref = create_refresh_token(db, user.id)
    found = find_valid_refresh_token(db, ref.token_hash)
    assert found is not None
    assert found.id == ref.id
    assert find_valid_refresh_token(db, "nonexistent") is None


def test_rotate_refresh_token(db: Session):
    cls = Class(id=uuid.uuid4(), name="4W", year_start=2024, grade=4, letter="W", shift="morning", archived=False)
    db.add(cls)
    db.flush()
    user = User(
        id=uuid.uuid4(),
        email="rot@test.com",
        password_hash=hash_password("x"),
        name="User",
        role="student",
    )
    db.add(user)
    db.flush()
    raw, ref = create_refresh_token(db, user.id)
    result = rotate_refresh_token(db, ref.token_hash)
    assert result is not None
    new_raw, same_user = result
    assert same_user.id == user.id
    assert new_raw != raw
    assert rotate_refresh_token(db, ref.token_hash) is None


def test_revoke_all_refresh_tokens_for_user(db: Session):
    cls = Class(id=uuid.uuid4(), name="5V", year_start=2024, grade=5, letter="V", shift="morning", archived=False)
    db.add(cls)
    db.flush()
    user = User(
        id=uuid.uuid4(),
        email="revall@test.com",
        password_hash=hash_password("x"),
        name="User",
        role="student",
    )
    db.add(user)
    db.flush()
    create_refresh_token(db, user.id)
    create_refresh_token(db, user.id)
    revoke_all_refresh_tokens_for_user(db, user.id)
    tokens = db.query(RefreshToken).filter(RefreshToken.user_id == user.id).all()
    assert all(t.revoked == "Y" for t in tokens)
