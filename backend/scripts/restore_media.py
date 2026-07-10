"""Safely replace the media directory from a gzipped tar stream."""

from __future__ import annotations

import shutil
import sys
import tarfile
import tempfile
from pathlib import Path, PurePosixPath


def _validate_member(member: tarfile.TarInfo) -> None:
    path = PurePosixPath(member.name)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"unsafe archive path: {member.name!r}")
    if member.issym() or member.islnk() or member.isdev():
        raise ValueError(f"unsupported archive member: {member.name!r}")


def restore(archive_path: Path, target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix=".restore-work-", dir=target))
    old = Path(tempfile.mkdtemp(prefix=".restore-old-", dir=target))
    try:
        with tarfile.open(archive_path, mode="r:gz") as archive:
            members = archive.getmembers()
            for member in members:
                _validate_member(member)
            archive.extractall(work, members=members, filter="data")

        previous = [entry for entry in target.iterdir() if entry not in (work, old)]
        installed: list[Path] = []
        try:
            for entry in previous:
                entry.replace(old / entry.name)
            for entry in list(work.iterdir()):
                destination = target / entry.name
                entry.replace(destination)
                installed.append(destination)
        except Exception:
            for entry in installed:
                if entry.is_dir():
                    shutil.rmtree(entry)
                else:
                    entry.unlink(missing_ok=True)
            for entry in list(old.iterdir()):
                entry.replace(target / entry.name)
            raise
    finally:
        shutil.rmtree(work, ignore_errors=True)
        shutil.rmtree(old, ignore_errors=True)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: restore_media.py ARCHIVE TARGET")
    if sys.argv[1] != "-":
        restore(Path(sys.argv[1]), Path(sys.argv[2]))
        return
    with tempfile.NamedTemporaryFile(suffix=".tar.gz") as archive:
        shutil.copyfileobj(sys.stdin.buffer, archive)
        archive.flush()
        restore(Path(archive.name), Path(sys.argv[2]))


if __name__ == "__main__":
    main()
