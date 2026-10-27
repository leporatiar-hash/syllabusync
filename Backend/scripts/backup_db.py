"""Read-only snapshot of every table to ops/backups/classmate-YYYYMMDD-HHMM.json.gz.

Run with `railway run -s Postgres -- Backend/venv_fresh/bin/python Backend/scripts/backup_db.py`.
"""
import datetime
import gzip
import json
import os

from sqlalchemy import MetaData, create_engine

url = os.environ.get("DATABASE_PUBLIC_URL") or os.environ["DATABASE_URL"]
engine = create_engine(url.replace("postgres://", "postgresql://", 1))
meta = MetaData()
meta.reflect(bind=engine)

out = {}
with engine.connect() as conn:
    conn.exec_driver_sql("SET TRANSACTION READ ONLY")
    for name, table in meta.tables.items():
        out[name] = [dict(r._mapping) for r in conn.execute(table.select())]

stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M")
path = os.path.join(os.path.dirname(__file__), "..", "..", "ops", "backups", f"classmate-{stamp}.json.gz")
with gzip.open(path, "wt") as f:
    json.dump(out, f, default=str)
os.chmod(path, 0o600)
print(path, {k: len(v) for k, v in out.items() if k in ("users", "user_profiles", "courses", "deadlines")})
