import sqlite3
import sys
from pathlib import Path

db = Path(__file__).resolve().parents[1] / "data" / "shop.db"
conn = sqlite3.connect(str(db))
cur = conn.cursor()
tables = [
    r[0]
    for r in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
]
for t in tables:
    print(t)
    for col in cur.execute(f"PRAGMA table_info({t})"):
        print(" ", col)
conn.close()
