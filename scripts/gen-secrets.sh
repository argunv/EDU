#!/usr/bin/env bash
# Generate strong secrets into .env (creates from .env.production.example if missing).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

rand() {
  openssl rand -base64 48 | tr -d '\n/+=' | head -c 48
}

if [[ ! -f .env ]]; then
  cp .env.production.example .env
  echo "Created .env from .env.production.example"
fi

export GEN_JWT
export GEN_DB
export GEN_MQ
export GEN_ADMIN
export GEN_GRAFANA
GEN_JWT="$(rand)"
GEN_DB="$(rand)"
GEN_MQ="$(rand)"
GEN_ADMIN="$(rand)"
GEN_GRAFANA="$(rand)"

python3 <<'PY'
import os, re
from pathlib import Path

jwt = os.environ["GEN_JWT"]
db = os.environ["GEN_DB"]
mq = os.environ["GEN_MQ"]
admin = os.environ["GEN_ADMIN"]
grafana = os.environ["GEN_GRAFANA"]

path = Path(".env")
text = path.read_text(encoding="utf-8")

def set_key(text: str, key: str, value: str) -> str:
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.M)
    line = f"{key}={value}"
    if pattern.search(text):
        return pattern.sub(line, text)
    return text.rstrip() + "\n" + line + "\n"

weak = ("CHANGE_ME", "dev-only", "postgres", "edu_mq_dev_pass", "change-me")

def needs_replace(key: str, current: str) -> bool:
    cur = (current or "").strip().strip("'\"")
    if not cur:
        return True
    low = cur.lower()
    if any(w in low for w in weak):
        return True
    if key == "JWT_SECRET" and len(cur) < 32:
        return True
    return False

vals = {}
for line in text.splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, _, v = line.partition("=")
        vals[k.strip()] = v

for key, value in {
    "JWT_SECRET": jwt,
    "POSTGRES_PASSWORD": db,
    "RABBITMQ_PASSWORD": mq,
    "ADMIN_PASSWORD": admin,
    "GRAFANA_ADMIN_PASSWORD": grafana,
}.items():
    if needs_replace(key, vals.get(key, "")):
        text = set_key(text, key, value)
        print(f"set {key}")

vals2 = {}
for line in text.splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, _, v = line.partition("=")
        vals2[k.strip()] = v

pg_user = vals2.get("POSTGRES_USER", "abh_edu").strip() or "abh_edu"
pg_db = vals2.get("POSTGRES_DB", "abh_edu").strip() or "abh_edu"
mq_u = vals2.get("RABBITMQ_USER", "abh_edu_mq").strip() or "abh_edu_mq"
db_pass = vals2.get("POSTGRES_PASSWORD", db)
mq_pass = vals2.get("RABBITMQ_PASSWORD", mq)

text = set_key(
    text,
    "DATABASE_URL",
    f"postgresql+psycopg2://{pg_user}:{db_pass}@postgres:5432/{pg_db}",
)
text = set_key(
    text,
    "RABBITMQ_URL",
    f"amqp://{mq_u}:{mq_pass}@rabbitmq:5672/",
)
print("synced DATABASE_URL and RABBITMQ_URL")
path.write_text(text, encoding="utf-8")
print("Done. Edit DOMAIN / FRONTEND_URL / CORS_ORIGINS / SMTP_* then run ./scripts/check-env.sh")
PY
