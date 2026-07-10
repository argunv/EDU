from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.services.avatar_storage import resolve_media_file

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/{file_path:path}")
def get_media_file(file_path: str):
    if ".." in file_path.split("/"):
        raise HTTPException(status_code=404, detail="Not found")
    path: Path = resolve_media_file(file_path)
    return FileResponse(
        path,
        media_type="image/webp" if path.suffix.lower() == ".webp" else None,
        headers={"Cache-Control": "public, max-age=3600"},
    )
