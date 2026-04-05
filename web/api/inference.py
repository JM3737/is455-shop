"""
Vercel Python serverless: late-delivery scoring (Chapter 17).
Uses Turso embedded replica in /tmp when TURSO_* is set; else local ../../data/shop.db.
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

import joblib
import pandas as pd

FEATURE_COLS = [
    "num_items",
    "num_distinct_products",
    "avg_unit_price",
    "total_line_value",
    "order_subtotal",
    "shipping_fee",
    "promo_used",
    "customer_age",
    "customer_order_count",
    "order_dow",
    "order_hour",
]

_API_DIR = os.path.dirname(os.path.abspath(__file__))
_WEB_ROOT = os.path.normpath(os.path.join(_API_DIR, ".."))
_REPO_ROOT = os.path.normpath(os.path.join(_API_DIR, "..", ".."))
_MODEL_PATH = os.path.join(_WEB_ROOT, "ml", "late_delivery_model.sav")
_LOCAL_DB = os.path.join(_REPO_ROOT, "data", "shop.db")


def _open_sqlite_connection():
    """Return a sqlite3 connection (synced from Turso or local file)."""
    url = os.environ.get("TURSO_DATABASE_URL")
    token = os.environ.get("TURSO_AUTH_TOKEN", "")
    if url and token:
        import libsql

        path = os.path.join(tempfile.gettempdir(), "shop_turso_replica.db")
        ls = libsql.connect(path, sync_url=url, auth_token=token)
        ls.sync()
        ls.close()
        return sqlite3.connect(path), path, True
    if not os.path.exists(_LOCAL_DB):
        raise FileNotFoundError(f"shop.db not found at {_LOCAL_DB}")
    return sqlite3.connect(_LOCAL_DB), None, False


def _push_turso_sync(replica_path: str) -> None:
    url = os.environ.get("TURSO_DATABASE_URL")
    token = os.environ.get("TURSO_AUTH_TOKEN", "")
    if not url or not token:
        return
    import libsql

    ls = libsql.connect(replica_path, sync_url=url, auth_token=token)
    ls.sync()
    ls.close()


def _load_orders_to_score(conn: sqlite3.Connection) -> pd.DataFrame:
    q_unshipped = """
    SELECT
      o.order_id,
      o.customer_id,
      o.order_datetime,
      o.order_subtotal,
      o.shipping_fee,
      o.promo_used,
      c.birthdate
    FROM orders o
    JOIN customers c ON c.customer_id = o.customer_id
    LEFT JOIN shipments s ON s.order_id = o.order_id
    WHERE s.shipment_id IS NULL
    """
    df = pd.read_sql_query(q_unshipped, conn)
    if len(df) > 0:
        return df
    q_demo = """
    SELECT
      o.order_id,
      o.customer_id,
      o.order_datetime,
      o.order_subtotal,
      o.shipping_fee,
      o.promo_used,
      c.birthdate
    FROM orders o
    JOIN customers c ON c.customer_id = o.customer_id
    ORDER BY o.order_datetime DESC
    LIMIT 200
    """
    return pd.read_sql_query(q_demo, conn)


def _engineer_features(conn: sqlite3.Connection, df_live: pd.DataFrame) -> pd.DataFrame:
    if df_live.empty:
        return df_live
    oi = pd.read_sql_query("SELECT * FROM order_items", conn)
    oi_agg = (
        oi[oi["order_id"].isin(df_live["order_id"])]
        .groupby("order_id")
        .agg(
            num_items=("quantity", "sum"),
            num_distinct_products=("product_id", "nunique"),
            avg_unit_price=("unit_price", "mean"),
            total_line_value=("line_total", "sum"),
        )
        .reset_index()
    )
    df = df_live.merge(oi_agg, on="order_id", how="left")
    df["order_datetime"] = pd.to_datetime(df["order_datetime"], errors="coerce")
    df["birthdate"] = pd.to_datetime(df["birthdate"], errors="coerce")
    df["customer_age"] = (df["order_datetime"] - df["birthdate"]).dt.days // 365
    df["order_dow"] = df["order_datetime"].dt.dayofweek
    df["order_hour"] = df["order_datetime"].dt.hour
    counts = pd.read_sql_query(
        "SELECT customer_id, COUNT(*) AS customer_order_count FROM orders GROUP BY customer_id",
        conn,
    )
    return df.merge(counts, on="customer_id", how="left")


def run_inference() -> tuple[int, str]:
    if not os.path.exists(_MODEL_PATH):
        raise FileNotFoundError(
            f"Model missing: {_MODEL_PATH}. Run python jobs/train_model.py and ensure web/ml contains the .sav (prebuild copies it)."
        )
    model = joblib.load(_MODEL_PATH)
    conn, replica_path, _is_remote = _open_sqlite_connection()
    try:
        df_live = _load_orders_to_score(conn)
        if df_live.empty:
            return 0, "No orders to score."
        df_feat = _engineer_features(conn, df_live)
        x = df_feat[FEATURE_COLS]
        probs = model.predict_proba(x)[:, 1]
        preds = model.predict(x)
        ts = datetime.now(timezone.utc).isoformat()

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
        rows = [
            (int(oid), float(p), int(yhat), ts)
            for oid, p, yhat in zip(df_feat["order_id"], probs, preds)
        ]
        cur.executemany(
            """
            INSERT OR REPLACE INTO order_predictions
            (order_id, late_delivery_probability, predicted_late_delivery, prediction_timestamp)
            VALUES (?, ?, ?, ?)
            """,
            rows,
        )
        conn.commit()
        msg = f"Inference complete. Predictions written: {len(rows)}"
        print(msg, file=sys.stderr)
        return len(rows), msg
    finally:
        conn.close()
        if replica_path:
            _push_turso_sync(replica_path)


class handler(BaseHTTPRequestHandler):
    def log_message(self, _format, *_args):
        return

    def do_POST(self):
        try:
            n, stdout = run_inference()
            body = json.dumps(
                {"ok": True, "scored": n, "stdout": stdout, "timestamp": datetime.now(timezone.utc).isoformat()}
            )
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body.encode())
        except Exception as e:
            err = json.dumps(
                {
                    "ok": False,
                    "error": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(err.encode())
