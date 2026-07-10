from __future__ import annotations

import io
import os
import tempfile
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, status
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

ALLOWED_IMAGE_CONTENT_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
    }
)
ALLOWED_IMAGE_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".webp"})
MAX_IMAGE_PIXELS = 25_000_000


def media_root() -> Path:
    root = Path(settings.media_root)
    root.mkdir(parents=True, exist_ok=True)
    return root


def avatar_relative_path(user_id: UUID) -> str:
    return f"avatars/{user_id}.webp"


def avatar_absolute_path(user_id: UUID) -> Path:
    return media_root() / avatar_relative_path(user_id)


def avatar_public_url(avatar_path: str | None) -> str | None:
    if not avatar_path:
        return None
    from app.services.media_signing import sign_media_url

    safe_path = avatar_path.lstrip("/")
    base = f"/api/media/{safe_path}"
    path = media_root() / safe_path
    if path.is_file():
        version = int(path.stat().st_mtime)
        base = f"{base}?v={version}"
    return sign_media_url(base)


def delete_avatar_file(user_id: UUID) -> None:
    path = avatar_absolute_path(user_id)
    if path.is_file():
        path.unlink()


def save_avatar_from_bytes(user_id: UUID, data: bytes, content_type: str | None) -> str:
    if len(data) > settings.avatar_max_bytes:
        max_mb = settings.avatar_max_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Файл слишком большой. Максимум {max_mb} МБ",
        )

    normalized_type = (
        content_type.split(";")[0].strip().lower() if content_type else None
    )
    if normalized_type and normalized_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимый формат. Разрешены JPEG, PNG и WebP",
        )

    try:
        image = Image.open(io.BytesIO(data))
        width, height = image.size
        if width * height > MAX_IMAGE_PIXELS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Изображение имеет слишком большое разрешение",
            )
        image.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось прочитать изображение. Проверьте формат файла",
        ) from exc

    if image.format and image.format.upper() not in {"JPEG", "PNG", "WEBP"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимый формат. Разрешены JPEG, PNG и WebP",
        )

    if width < 64 or height < 64:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Изображение слишком маленькое. Минимум 64×64 пикселя",
        )

    image = image.convert("RGBA")
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    image = image.crop((left, top, left + side, top + side))
    output_size = settings.avatar_output_size_px
    image = image.resize((output_size, output_size), Image.Resampling.LANCZOS)

    dest = avatar_absolute_path(user_id)
    dest.parent.mkdir(parents=True, exist_ok=True)
    rgb = Image.new("RGB", image.size, (255, 255, 255))
    rgb.paste(image, mask=image.split()[3])
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{user_id}-", suffix=".webp", dir=dest.parent
    )
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        rgb.save(tmp_path, format="WEBP", quality=85, method=6)
        tmp_path.replace(dest)
    finally:
        tmp_path.unlink(missing_ok=True)

    return avatar_relative_path(user_id)


def resolve_media_file(relative_path: str) -> Path:
    root = media_root().resolve()
    candidate = (root / relative_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not candidate.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return candidate
