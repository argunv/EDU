#!/usr/bin/env bash
# Backup PostgreSQL dump + media volume tarball into ./backups/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_lib.sh
source "$ROOT/scripts/_lib.sh"

require_env_file
unset COMPOSE_FILE COMPOSE_PROFILES || true
load_dotenv

PGUSER="${POSTGRES_USER:-postgres}"
PGDB="${POSTGRES_DB:-abh_edu}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${ROOT}/backups"
mkdir -p "$OUT_DIR"

DUMP="${OUT_DIR}/db_${PGDB}_${STAMP}.sql.gz"
MEDIA="${OUT_DIR}/media_${STAMP}.tar.gz"

echo "[backup] database → $DUMP"
compose exec -T postgres pg_dump -U "$PGUSER" "$PGDB" | gzip -c > "$DUMP"

echo "[backup] media volume → $MEDIA"
compose exec -T api sh -c 'cd /app/media && tar -cf - .' | gzip -c > "$MEDIA"

prune() {
  local pattern="$1"
  local keep=14
  local files
  files="$(ls -1t ${pattern} 2>/dev/null || true)"
  if [[ -z "$files" ]]; then
    return 0
  fi
  echo "$files" | tail -n +"$((keep + 1))" | while read -r f; do
    [[ -n "$f" ]] && rm -f "$f"
  done
}

prune "$OUT_DIR"/db_*.sql.gz
prune "$OUT_DIR"/media_*.tar.gz

echo "[backup] done"
ls -lh "$DUMP" "$MEDIA"
