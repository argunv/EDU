"""Create abh_edu_test database if it does not exist. Used by test container."""
import os
import sys

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


def main():
    # Connect to default 'postgres' db to create abh_edu_test
    url = os.environ.get("DATABASE_URL", "")
    if not url or "abh_edu_test" not in url:
        return 0
    # postgresql+psycopg2://... -> postgresql://... for psycopg2.connect()
    dsn = url.replace("postgresql+psycopg2://", "postgresql://", 1).split("?")[0]
    dsn = dsn.replace("/abh_edu_test", "/postgres")
    try:
        conn = psycopg2.connect(dsn)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = 'abh_edu_test'")
        if cur.fetchone() is None:
            cur.execute("CREATE DATABASE abh_edu_test")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"ensure_test_db: {e}", file=sys.stderr)
        sys.exit(1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
