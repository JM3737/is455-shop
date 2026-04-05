"""
ETL: shop.db (operational) -> warehouse.db fact_orders_ml (modeling).
"""
import pandas as pd

from config import OP_DB_PATH, WH_DB_PATH
from utils_db import sqlite_conn


def build_modeling_table() -> int:
    with sqlite_conn(OP_DB_PATH) as conn:
        orders = pd.read_sql("SELECT * FROM orders", conn)
        customers = pd.read_sql("SELECT * FROM customers", conn)
        order_items = pd.read_sql("SELECT * FROM order_items", conn)
        shipments = pd.read_sql(
            "SELECT order_id, late_delivery FROM shipments", conn
        )

    oi_agg = (
        order_items.groupby("order_id")
        .agg(
            num_items=("quantity", "sum"),
            num_distinct_products=("product_id", "nunique"),
            avg_unit_price=("unit_price", "mean"),
            total_line_value=("line_total", "sum"),
        )
        .reset_index()
    )

    df = (
        orders.merge(customers, on="customer_id", how="left")
        .merge(oi_agg, on="order_id", how="left")
        .merge(shipments, on="order_id", how="left")
    )

    df["order_datetime"] = pd.to_datetime(df["order_datetime"], errors="coerce")
    df["birthdate"] = pd.to_datetime(df["birthdate"], errors="coerce")
    df["customer_age"] = (df["order_datetime"] - df["birthdate"]).dt.days // 365
    df["order_dow"] = df["order_datetime"].dt.dayofweek
    df["order_hour"] = df["order_datetime"].dt.hour
    df["customer_order_count"] = df.groupby("customer_id")["order_id"].transform(
        "count"
    )

    num_cols = [
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
    for c in num_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")

    modeling_cols = [
        "order_id",
        "customer_id",
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
        "late_delivery",
    ]
    df_model = df[modeling_cols].dropna(subset=["late_delivery"])

    WH_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite_conn(WH_DB_PATH) as wh_conn:
        df_model.to_sql("fact_orders_ml", wh_conn, if_exists="replace", index=False)

    return len(df_model)


if __name__ == "__main__":
    n = build_modeling_table()
    print(f"Warehouse updated. fact_orders_ml rows: {n}")
