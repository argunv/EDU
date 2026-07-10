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

if [[ $fail -ne 0 ]]; then
  echo "Fix .env and re-run ./scripts/check-env.sh" >&2
  exit 1
fi

echo "OK: .env looks production-ready"
