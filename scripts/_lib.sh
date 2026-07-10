#!/usr/bin/env bash
# Shared helpers for deploy scripts. Source from other scripts; do not execute alone.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Always pin both files; never load docker-compose.override.yml.
compose() {
  env -u COMPOSE_FILE docker compose \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    "$@"
}

require_env_file() {
  if [[ ! -f .env ]]; then
    echo "Missing .env — copy .env.production.example and fill secrets:" >&2
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
    export "$key=$value"
  done < .env
}
