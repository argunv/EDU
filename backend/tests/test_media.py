"""Тесты раздачи медиафайлов GET /api/media/*."""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.models.role_profiles import UserRole
from app.models.user import User
from app.services.auth import hash_password
from app.services.avatar_storage import save_avatar_from_bytes


def _png_bytes(size: int = 64) -> bytes:
    from PIL import Image
    import io

    img = Image.new("RGB", (size, size), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def media_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "media_root", str(tmp_path))
    return tmp_path


def test_get_media_avatar_file(client: TestClient, db, media_tmp):
    user = User(
        id=uuid.uuid4(),
        email="media@test.com",
        password_hash=hash_password("secret"),
        name="Media User",
        role="admin",
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()

    relative = save_avatar_from_bytes(user.id, _png_bytes(), "image/png")

    res = client.get(f"/api/media/{relative}")
    assert res.status_code == 200
    assert res.headers.get("content-type", "").startswith("image/")


def test_get_media_unknown_file_404(client: TestClient, media_tmp):
    res = client.get("/api/media/avatars/does-not-exist.webp")
    assert res.status_code == 404
