"""
Score unshipped orders (or 200 most recent if none unshipped) and write order_predictions.
"""
from __future__ import annotations

from datetime import datetime, timezone

import joblib
import pandas as pd

from config import FEATURE_COLS, MODEL_PATH, OP_DB_PATH
from utils_db import ensure_predictions_table, sqlite_conn


def _load_orders_to_score(conn) -> pd.DataFrame:
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
    df = pd.read_sql(q_unshipped, conn)
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
    return pd.read_sql(q_demo, conn)


def _engineer_features(conn, df_live: pd.DataFrame) -> pd.DataFrame:
    if df_live.empty:
        return df_live

    oi = pd.read_sql("SELECT * FROM order_items", conn)
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

    counts = pd.read_sql(
        "SELECT customer_id, COUNT(*) AS customer_order_count FROM orders GROUP BY customer_id",
        conn,
    )
    df = df.merge(counts, on="customer_id", how="left")
    return df


def run_inference() -> int:
    model = joblib.load(MODEL_PATH)

    with sqlite_conn(OP_DB_PATH) as conn:
        df_live = _load_orders_to_score(conn)
        if df_live.empty:
            print("No orders to score.")
            return 0
        df_feat = _engineer_features(conn, df_live)
        X = df_feat[FEATURE_COLS]
        probs = model.predict_proba(X)[:, 1]
        preds = model.predict(X)
        ts = datetime.now(timezone.utc).isoformat()

        ensure_predictions_table(conn)
        cur = conn.cursor()
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

    print(f"Inference complete. Predictions written: {len(rows)}")
    return len(rows)


if __name__ == "__main__":
    run_inference()
