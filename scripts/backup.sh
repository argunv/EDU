#!/usr/bin/env bash
# Backup PostgreSQL dump + media volume tarball into ./backups/
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_lib.sh
source "$ROOT/scripts/_lib.sh"
acquire_operation_lock

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
DUMP_TMP="${DUMP}.tmp"
MEDIA_TMP="${MEDIA}.tmp"
paused_services=()
api_was_paused=0

cleanup() {
  rm -f "$DUMP_TMP" "$MEDIA_TMP"
  local service
  for service in "${paused_services[@]}"; do
    compose unpause "$service" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

if [[ -n "$(compose ps --status running -q api)" ]]; then
  compose pause api >/dev/null
  paused_services+=("api")
  api_was_paused=1
fi

echo "[backup] database → $DUMP"
compose exec -T postgres pg_dump \
  --clean --if-exists --no-owner --no-privileges \
  -U "$PGUSER" "$PGDB" | gzip -c > "$DUMP_TMP"
gzip -t "$DUMP_TMP"

echo "[backup] media volume → $MEDIA"
compose run --rm --no-deps -T api \
  sh -c 'mkdir -p /app/media && cd /app/media && tar -cf - .' | gzip -c > "$MEDIA_TMP"
gzip -dc "$MEDIA_TMP" | tar -tf - >/dev/null

mv "$DUMP_TMP" "$DUMP"
mv "$MEDIA_TMP" "$MEDIA"
cleanup
paused_services=()
trap - EXIT

if [[ "$api_was_paused" -eq 1 ]]; then
  api_container="$(compose ps -q api)"
  healthy=0
  for _ in $(seq 1 30); do
    if [[ "$(docker inspect --format '{{.State.Health.Status}}' "$api_container" 2>/dev/null || true)" == "healthy" ]]; then
      healthy=1
      break
    fi
    sleep 2
  done
  if [[ "$healthy" -ne 1 ]]; then
    echo "[backup] ERROR: api health did not recover after backup" >&2
    exit 1
  fi
fi

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
