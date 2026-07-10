#!/usr/bin/env bash
# Shared helpers for deploy scripts. Source from other scripts; do not execute alone.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${ENV_FILE:-.env}"

# Always pin both files; never load docker-compose.override.yml.
compose() {
  env -u COMPOSE_FILE docker compose \
    --env-file "$ENV_FILE" \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    "$@"
}

acquire_operation_lock() {
  if [[ "${ABH_EDU_OPERATION_LOCK_HELD:-0}" == "1" ]]; then
    return
  fi
  if ! command -v flock >/dev/null 2>&1; then
    echo "WARN: flock unavailable; operation serialization is disabled" >&2
    return
  fi
  local lock_name
  if command -v sha256sum >/dev/null 2>&1; then
    lock_name="$(printf '%s' "$ROOT" | sha256sum | cut -c1-16)"
  else
    lock_name="$(printf '%s' "$ROOT" | shasum -a 256 | cut -c1-16)"
  fi
  exec 9>"/tmp/abh-edu-${lock_name}.lock"
  flock -n 9 || {
    echo "Another ABH Edu deploy/backup/restore operation is running" >&2
    exit 1
  }
  export ABH_EDU_OPERATION_LOCK_HELD=1
}

require_env_file() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE — copy .env.production.example and fill secrets:" >&2
    echo "  cp .env.production.example .env && ./scripts/gen-secrets.sh" >&2
    exit 1
  fi
}

# Export KEY=value from .env without bash-sourcing (JSON / special chars safe).
load_dotenv() {
  local key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"
    value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    # Strip optional surrounding single/double quotes
    if [[ "$value" =~ ^\".*\"$ ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:${#value}-2}"
    fi
    # Явно переданные переменные имеют приоритет над env-файлом.
    if ! printenv "$key" >/dev/null 2>&1; then
      export "$key=$value"
    fi
  done < "$ENV_FILE"
}

nginx_health_url() {
  local published="${NGINX_HOST_PORT:-80}"
  if [[ "$published" == http://* || "$published" == https://* ]]; then
    printf '%s/api/health' "${published%/}"
  elif [[ "$published" == *:* ]]; then
    printf 'http://%s/api/health' "$published"
  else
    printf 'http://127.0.0.1:%s/api/health' "$published"
  fi
}
