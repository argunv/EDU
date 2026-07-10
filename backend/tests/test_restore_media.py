import io
import tarfile
from pathlib import Path

import pytest

from scripts.restore_media import restore


def _write_archive(path: Path, members: dict[str, bytes]) -> None:
    with tarfile.open(path, "w:gz") as archive:
        for name, content in members.items():
            info = tarfile.TarInfo(name)
            info.size = len(content)
            archive.addfile(info, io.BytesIO(content))


def test_restore_replaces_media_tree(tmp_path):
    target = tmp_path / "media"
    target.mkdir()
    (target / "old.webp").write_bytes(b"old")
    archive = tmp_path / "media.tar.gz"
    _write_archive(archive, {"avatars/new.webp": b"new"})

    restore(archive, target)

    assert not (target / "old.webp").exists()
    assert (target / "avatars/new.webp").read_bytes() == b"new"


def test_restore_rejects_path_traversal_without_changing_media(tmp_path):
    target = tmp_path / "media"
    target.mkdir()
    original = target / "original.webp"
    original.write_bytes(b"original")
    archive = tmp_path / "evil.tar.gz"
    _write_archive(archive, {"../../escaped": b"owned"})

    with pytest.raises(ValueError, match="unsafe archive path"):
        restore(archive, target)

    assert original.read_bytes() == b"original"
    assert not (tmp_path / "escaped").exists()
