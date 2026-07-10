from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.services.avatar_storage import resolve_media_file
from app.services.media_signing import verify_media_signature

router = APIRouter(prefix="/media", tags=["media"])


@router.get("/{file_path:path}")
def get_media_file(
    file_path: str,
    exp: str | None = Query(default=None),
    sig: str | None = Query(default=None),
):
    if ".." in file_path.split("/"):
        raise HTTPException(status_code=404, detail="Not found")
    # Signed URL required so <img> works without Bearer, but UUID paths are not guessable alone.
    media_path = f"/api/media/{file_path}"
    if not verify_media_signature(media_path, exp, sig):
        raise HTTPException(status_code=404, detail="Not found")
    path: Path = resolve_media_file(file_path)
    return FileResponse(
        path,
        media_type="image/webp" if path.suffix.lower() == ".webp" else None,
        headers={"Cache-Control": "private, max-age=3600"},
    )
