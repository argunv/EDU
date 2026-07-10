from __future__ import annotations

import io
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
    base = f"/api/media/{avatar_path.lstrip('/')}"
    path = media_root() / avatar_path
    if path.is_file():
        version = int(path.stat().st_mtime)
        return f"{base}?v={version}"
    return base


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

    if content_type and content_type.split(";")[0].strip().lower() not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимый формат. Разрешены JPEG, PNG и WebP",
        )

    try:
        image = Image.open(io.BytesIO(data))
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

    width, height = image.size
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
    rgb.save(dest, format="WEBP", quality=85, method=6)

    return avatar_relative_path(user_id)


def resolve_media_file(relative_path: str) -> Path:
    root = media_root().resolve()
    candidate = (root / relative_path).resolve()
    if not str(candidate).startswith(str(root)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not candidate.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return candidate
