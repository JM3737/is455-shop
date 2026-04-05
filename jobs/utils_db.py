from contextlib import contextmanager
import sqlite3
from pathlib import Path


@contextmanager
def sqlite_conn(db_path: Path):
    conn = sqlite3.connect(str(db_path))
    try:
        yield conn
    finally:
        conn.close()


def ensure_predictions_table(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS order_predictions (
            order_id INTEGER PRIMARY KEY,
            late_delivery_probability REAL,
            predicted_late_delivery INTEGER,
            prediction_timestamp TEXT
        )
        """
    )
    conn.commit()
