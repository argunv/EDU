#!/usr/bin/env bash
# Restore PostgreSQL and media from a backup pair created by backup.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_lib.sh
source "$ROOT/scripts/_lib.sh"
acquire_operation_lock

YES=0
if [[ "${1:-}" == "--yes" ]]; then
  YES=1
  shift
fi

DB_BACKUP="${1:-}"
MEDIA_BACKUP="${2:-}"
if [[ -z "$DB_BACKUP" || -z "$MEDIA_BACKUP" || $# -ne 2 ]]; then
  echo "Usage: $0 [--yes] backups/db_*.sql.gz backups/media_*.tar.gz" >&2
  exit 1
fi
[[ -f "$DB_BACKUP" ]] || { echo "Database backup not found: $DB_BACKUP" >&2; exit 1; }
[[ -f "$MEDIA_BACKUP" ]] || { echo "Media backup not found: $MEDIA_BACKUP" >&2; exit 1; }
gzip -t "$DB_BACKUP"
gzip -dc "$MEDIA_BACKUP" | tar -tf - >/dev/null

require_env_file
"$ROOT/scripts/check-env.sh"
load_dotenv

if [[ "$YES" -ne 1 ]]; then
  if [[ ! -t 0 ]]; then
    echo "Refusing destructive restore without --yes in non-interactive mode" >&2
    exit 1
  fi
  read -r -p "Restore will replace the production database and media. Type RESTORE: " answer
  [[ "$answer" == "RESTORE" ]] || { echo "Restore cancelled"; exit 1; }
fi

PGUSER="${POSTGRES_USER:-postgres}"
PGDB="${POSTGRES_DB:-abh_edu}"

echo "[restore] preparing images and stopping application writers"
compose build api automigrate
compose stop nginx notifier api >/dev/null 2>&1 || true
compose up -d postgres

ready=0
for _ in $(seq 1 30); do
  if compose exec -T postgres pg_isready -U "$PGUSER" -d "$PGDB" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" -ne 1 ]]; then
  echo "[restore] PostgreSQL did not become ready" >&2
  exit 1
fi

echo "[restore] database ← $DB_BACKUP"
gzip -dc "$DB_BACKUP" | compose exec -T postgres \
  psql --single-transaction -v ON_ERROR_STOP=1 -U "$PGUSER" -d "$PGDB"

echo "[restore] media ← $MEDIA_BACKUP"
compose run --rm --no-deps -T api \
  python /app/scripts/restore_media.py - /app/media < "$MEDIA_BACKUP"

echo "[restore] applying migrations and starting verified stack"
"$ROOT/scripts/deploy.sh"
echo "[restore] done"
