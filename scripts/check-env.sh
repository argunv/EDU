#!/usr/bin/env bash
# Validate .env before production deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_lib.sh
source "$ROOT/scripts/_lib.sh"

require_env_file
load_dotenv

fail=0
warn() { echo "WARN: $*" >&2; }
die() { echo "ERROR: $*" >&2; fail=1; }

env_mode="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE" 2>/dev/null || true)"
if [[ -z "$env_mode" ]]; then
  warn "could not determine $ENV_FILE permissions"
elif (( (8#$env_mode & 8#077) != 0 )); then
  die "$ENV_FILE permissions are $env_mode; run: chmod 600 $ENV_FILE"
fi

[[ "${ENVIRONMENT:-}" == "production" ]] || die "ENVIRONMENT must be production (got: ${ENVIRONMENT:-})"

jwt="${JWT_SECRET:-}"
[[ ${#jwt} -ge 32 ]] || die "JWT_SECRET must be ≥ 32 characters"
case "$jwt" in
  *change-me*|*dev-only*|*CHANGE_ME*) die "JWT_SECRET still looks like a placeholder" ;;
esac

frontend="${FRONTEND_URL:-}"
[[ "$frontend" == https://* ]] || die "FRONTEND_URL must start with https://"
case "$frontend" in
  *localhost*) die "FRONTEND_URL must not use localhost in production" ;;
esac

db_url="${DATABASE_URL:-}"
[[ "$db_url" == *"@postgres:"* ]] || warn "DATABASE_URL host is not 'postgres' — OK only if you use external DB"
case "$db_url" in
  *postgres:postgres*|*CHANGE_ME*) die "DATABASE_URL has weak/placeholder credentials" ;;
esac

mq="${RABBITMQ_URL:-}"
case "$mq" in
  *guest:guest*|*edu_mq_dev_pass*|*CHANGE_ME*) die "RABBITMQ_URL has weak/placeholder credentials" ;;
esac

check_nonempty() {
  local key="$1"
  local val="${!key-}"
  [[ -n "$val" ]] || die "$key is empty"
  case "$val" in
    *CHANGE_ME*) die "$key still contains CHANGE_ME" ;;
  esac
}

check_nonempty POSTGRES_PASSWORD
check_nonempty RABBITMQ_PASSWORD
check_nonempty SMTP_HOST
check_nonempty SMTP_USER
check_nonempty SMTP_PASSWORD
check_nonempty SMTP_FROM

if [[ -n "${ADMIN_EMAIL:-}" || -n "${ADMIN_PASSWORD:-}" ]]; then
  check_nonempty ADMIN_EMAIL
  check_nonempty ADMIN_PASSWORD
  admin_password="${ADMIN_PASSWORD:-}"
  [[ ${#admin_password} -ge 12 ]] || die "ADMIN_PASSWORD must be at least 12 characters"
  case "${ADMIN_PASSWORD:-}" in
    *CHANGE_ME*|*change-me*|*dev-only*) die "ADMIN_PASSWORD still looks like a placeholder" ;;
  esac
fi

case "${SMTP_HOST}" in
  localhost) warn "SMTP_HOST=localhost — password reset emails will not leave the host" ;;
esac
case "${SMTP_USER}" in
  dev) warn "SMTP_USER looks like a stub" ;;
esac

cors="${CORS_ORIGINS:-}"
[[ -n "$cors" ]] || die "CORS_ORIGINS is empty"
case "$cors" in
  *localhost*) warn "CORS_ORIGINS contains localhost — unusual for production" ;;
esac
if ! python3 - "$frontend" "$cors" <<'PY'
import json
import sys

frontend = sys.argv[1].rstrip("/")
raw = sys.argv[2]
try:
    origins = json.loads(raw)
except json.JSONDecodeError as exc:
    raise SystemExit(f"CORS_ORIGINS is not valid JSON: {exc}") from exc
if not isinstance(origins, list) or not all(isinstance(x, str) for x in origins):
    raise SystemExit("CORS_ORIGINS must be a JSON array of strings")
normalized = [x.rstrip("/") for x in origins]
if "*" in normalized:
    raise SystemExit("CORS_ORIGINS must not contain '*' in production")
if frontend not in normalized:
    raise SystemExit("CORS_ORIGINS must contain FRONTEND_URL")
PY
then
  die "CORS_ORIGINS must be a JSON array containing FRONTEND_URL"
fi

if ! python3 <<'PY'
import os
from urllib.parse import unquote, urlsplit

def check_url(name: str, expected_user: str, expected_password: str, expected_host: str) -> None:
    parsed = urlsplit(os.environ.get(name, ""))
    if unquote(parsed.username or "") != os.environ.get(expected_user, ""):
        raise SystemExit(f"{name} user does not match {expected_user}")
    if unquote(parsed.password or "") != os.environ.get(expected_password, ""):
        raise SystemExit(f"{name} password does not match {expected_password}")
    if parsed.hostname != expected_host:
        raise SystemExit(f"{name} host must be {expected_host!r} for this Compose stack")

check_url("DATABASE_URL", "POSTGRES_USER", "POSTGRES_PASSWORD", "postgres")
check_url("RABBITMQ_URL", "RABBITMQ_USER", "RABBITMQ_PASSWORD", "rabbitmq")
PY
then
  die "DATABASE_URL / RABBITMQ_URL must match the service credentials"
fi

if [[ $fail -ne 0 ]]; then
  echo "Fix $ENV_FILE and re-run ./scripts/check-env.sh" >&2
  exit 1
fi

echo "OK: $ENV_FILE looks production-ready"
