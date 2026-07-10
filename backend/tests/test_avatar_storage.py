"""Unit-тесты сервиса хранения аватаров."""
import io
import uuid

import pytest
from fastapi import HTTPException
from PIL import Image

from app.core.config import settings
from app.services.avatar_storage import (
    avatar_public_url,
    avatar_relative_path,
    delete_avatar_file,
    resolve_media_file,
    save_avatar_from_bytes,
)


def _png_bytes(size: int = 64, color: str = "red") -> bytes:
    img = Image.new("RGB", (size, size), color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def media_tmp(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "media_root", str(tmp_path))
    return tmp_path


def test_save_avatar_from_bytes_creates_webp(media_tmp):
    user_id = uuid.uuid4()
    relative = save_avatar_from_bytes(user_id, _png_bytes(128), "image/png")

    assert relative == avatar_relative_path(user_id)
    dest = media_tmp / relative
    assert dest.is_file()
    assert dest.suffix == ".webp"


def test_save_avatar_rejects_oversized_file(media_tmp, monkeypatch):
    monkeypatch.setattr(settings, "avatar_max_bytes", 100)
    user_id = uuid.uuid4()

    with pytest.raises(HTTPException) as exc:
        save_avatar_from_bytes(user_id, _png_bytes(64), "image/png")

    assert exc.value.status_code == 400
    assert "большой" in exc.value.detail.lower()


def test_save_avatar_rejects_invalid_content_type(media_tmp):
    user_id = uuid.uuid4()

    with pytest.raises(HTTPException) as exc:
        save_avatar_from_bytes(user_id, b"not-an-image", "application/pdf")

    assert exc.value.status_code == 400
    assert "формат" in exc.value.detail.lower()


def test_save_avatar_rejects_corrupt_bytes(media_tmp):
    user_id = uuid.uuid4()

    with pytest.raises(HTTPException) as exc:
        save_avatar_from_bytes(user_id, b"fake-image-data", "image/png")

    assert exc.value.status_code == 400


def test_save_avatar_rejects_too_small_image(media_tmp):
    user_id = uuid.uuid4()

    with pytest.raises(HTTPException) as exc:
        save_avatar_from_bytes(user_id, _png_bytes(32), "image/png")

    assert exc.value.status_code == 400
    assert "маленьк" in exc.value.detail.lower()


def test_save_avatar_rejects_excessive_pixel_count(media_tmp, monkeypatch):
    monkeypatch.setattr("app.services.avatar_storage.MAX_IMAGE_PIXELS", 9_999)

    with pytest.raises(HTTPException) as exc:
        save_avatar_from_bytes(uuid.uuid4(), _png_bytes(100), "image/png")

    assert exc.value.status_code == 400
    assert "разрешение" in exc.value.detail.lower()


def test_avatar_public_url_none_when_no_path():
    assert avatar_public_url(None) is None
    assert avatar_public_url("") is None


def test_avatar_public_url_includes_cache_buster_when_file_exists(media_tmp):
    user_id = uuid.uuid4()
    relative = save_avatar_from_bytes(user_id, _png_bytes(64), "image/png")

    url = avatar_public_url(relative)
    assert url is not None
    assert url.startswith(f"/api/media/avatars/{user_id}.webp?v=")


def test_avatar_public_url_normalizes_leading_slash(media_tmp):
    user_id = uuid.uuid4()
    relative = save_avatar_from_bytes(user_id, _png_bytes(64), "image/png")

    url = avatar_public_url(f"/{relative}")

    assert url is not None
    assert url.startswith(f"/api/media/avatars/{user_id}.webp?v=")


def test_delete_avatar_file_removes_file(media_tmp):
    user_id = uuid.uuid4()
    save_avatar_from_bytes(user_id, _png_bytes(64), "image/png")
    delete_avatar_file(user_id)
    assert not (media_tmp / avatar_relative_path(user_id)).is_file()


def test_resolve_media_file_blocks_path_traversal(media_tmp):
    with pytest.raises(HTTPException) as exc:
        resolve_media_file("../../etc/passwd")

    assert exc.value.status_code == 404


def test_resolve_media_file_blocks_sibling_prefix_traversal(media_tmp):
    sibling = media_tmp.parent / f"{media_tmp.name}_evil"
    sibling.mkdir()
    (sibling / "secret.webp").write_bytes(b"secret")

    with pytest.raises(HTTPException) as exc:
        resolve_media_file(f"../{sibling.name}/secret.webp")

    assert exc.value.status_code == 404


def test_resolve_media_file_not_found(media_tmp):
    with pytest.raises(HTTPException) as exc:
        resolve_media_file("avatars/missing.webp")

    assert exc.value.status_code == 404
