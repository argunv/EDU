#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

if ! command -v htpasswd &>/dev/null; then
  echo "Нужен htpasswd. Установите: brew install httpd" >&2
  exit 1
fi

ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)
ADMIN_NAME=$(grep '^ADMIN_NAME=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | sed "s/'/''/g" | xargs)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)

if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_NAME" || -z "$ADMIN_PASSWORD" ]]; then
  echo "В .env должны быть заданы ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD" >&2
  exit 1
fi

HASH=$(htpasswd -nbBC 10 "" "$ADMIN_PASSWORD" | sed 's/^.*://' | sed 's/\$2y/\$2b/')
EMAIL_SQL=$(echo "$ADMIN_EMAIL" | tr '[:upper:]' '[:lower:]' | sed "s/'/''/g")
NAME_SQL=$(echo "$ADMIN_NAME" | sed "s/'/''/g")
HASH_ESC=$(echo "$HASH" | sed 's/\\/\\\\/g' | sed 's/\$/\\$/g')

docker compose exec -T postgres psql -U postgres -d abh_edu -c "INSERT INTO users (id, email, password_hash, name, role) VALUES (gen_random_uuid(), lower('$EMAIL_SQL'), '$HASH_ESC', '$NAME_SQL', 'admin') ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash, name = EXCLUDED.name;"

echo "Готово: $ADMIN_EMAIL"
