"""HMAC-signed media URLs for <img> without Bearer headers."""

from __future__ import annotations

import hashlib
import hmac
import time
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.core.config import settings

DEFAULT_TTL_SECONDS = 24 * 3600


def _sign(path: str, exp: int) -> str:
    message = f"{path}:{exp}".encode()
    return hmac.new(
        settings.jwt_secret.encode(),
        message,
        hashlib.sha256,
    ).hexdigest()


def sign_media_url(public_path: str, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> str:
    """
    Append exp+sig query params to a /api/media/... URL (preserves existing query like v=).
    """
    parts = urlsplit(public_path)
    path = parts.path
    exp = int(time.time()) + max(60, ttl_seconds)
    sig = _sign(path, exp)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["exp"] = str(exp)
    query["sig"] = sig
    return urlunsplit((parts.scheme, parts.netloc, path, urlencode(query), parts.fragment))


def verify_media_signature(path: str, exp: str | None, sig: str | None) -> bool:
    if not exp or not sig:
        return False
    try:
        exp_i = int(exp)
    except (TypeError, ValueError):
        return False
    if exp_i < int(time.time()):
        return False
    expected = _sign(path, exp_i)
    return hmac.compare_digest(expected, sig)
