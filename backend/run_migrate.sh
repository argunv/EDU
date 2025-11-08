#!/bin/sh
set -e
export DATABASE_URL="${DATABASE_URL:-postgresql+psycopg2://postgres:postgres@postgres:5432/abh_edu}"
cd /app && alembic upgrade head
