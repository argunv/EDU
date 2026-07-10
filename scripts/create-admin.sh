#!/usr/bin/env bash
# Create or promote an admin user from ADMIN_* in .env.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_lib.sh
source "$ROOT/scripts/_lib.sh"

require_env_file
unset COMPOSE_FILE COMPOSE_PROFILES || true
load_dotenv

if [[ -z "${ADMIN_EMAIL:-}" || -z "${ADMIN_PASSWORD:-}" ]]; then
  echo "Set ADMIN_EMAIL and ADMIN_PASSWORD in .env" >&2
  exit 1
fi
if [[ ${#ADMIN_PASSWORD} -lt 8 ]]; then
  echo "ADMIN_PASSWORD must be at least 8 characters" >&2
  exit 1
fi

ADMIN_NAME="${ADMIN_NAME:-Administrator}"
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD

echo "[create-admin] upserting ${ADMIN_EMAIL} …"
compose exec -T \
  -e ADMIN_EMAIL \
  -e ADMIN_NAME \
  -e ADMIN_PASSWORD \
  api python - <<'PY'
import os
from uuid import uuid4

from app.db.session import SessionLocal
from app.models.user import User
from app.models.role_profiles import UserRole
from app.services.auth import hash_password

email = os.environ["ADMIN_EMAIL"].lower().strip()
name = (os.environ.get("ADMIN_NAME") or "Administrator").strip() or "Administrator"
password = os.environ["ADMIN_PASSWORD"]

db = SessionLocal()
try:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            id=uuid4(),
            email=email,
            password_hash=hash_password(password),
            name=name,
            role="admin",
        )
        db.add(user)
        db.flush()
        print(f"created user {email}")
    else:
        user.password_hash = hash_password(password)
        user.name = name
        user.role = "admin"
        print(f"updated user {email}")
    db.query(UserRole).filter(UserRole.user_id == user.id).delete()
    db.add(UserRole(user_id=user.id, role="admin"))
    db.commit()
    print("role=admin OK")
finally:
    db.close()
PY

echo "[create-admin] done — login at ${FRONTEND_URL:-/}/auth/login"
