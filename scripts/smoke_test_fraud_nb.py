"""Quick smoke test for notebook modeling logic (no plots)."""
from pathlib import Path

import numpy as np
import pandas as pd
import sqlite3
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_selection import SelectFromModel
from sklearn.impute import SimpleImputer
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import RandomizedSearchCV, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "shop.db"
conn = sqlite3.connect(DB_PATH)
orders = pd.read_sql("SELECT * FROM orders", conn)
customers = pd.read_sql("SELECT * FROM customers", conn)
items = pd.read_sql("SELECT * FROM order_items", conn)
conn.close()

label = "is_fraud"
oi_agg = (
    items.groupby("order_id")
    .agg(
        num_items=("quantity", "sum"),
        num_distinct_products=("product_id", "nunique"),
        avg_unit_price=("unit_price", "mean"),
        total_line_value=("line_total", "sum"),
    )
    .reset_index()
)
df = orders.merge(customers, on="customer_id", how="left")
df = df.merge(oi_agg, on="order_id", how="left")
df["order_datetime"] = pd.to_datetime(df["order_datetime"], errors="coerce")
df["birthdate"] = pd.to_datetime(df["birthdate"], errors="coerce")
df["customer_age"] = (df["order_datetime"] - df["birthdate"]).dt.days // 365
df["order_dow"] = df["order_datetime"].dt.dayofweek
df["order_hour"] = df["order_datetime"].dt.hour
df["customer_order_count"] = df.groupby("customer_id")["order_id"].transform("count")

feature_numeric = [
    "order_subtotal",
    "shipping_fee",
    "tax_amount",
    "promo_used",
    "num_items",
    "num_distinct_products",
    "avg_unit_price",
    "total_line_value",
    "customer_age",
    "customer_order_count",
    "order_dow",
    "order_hour",
]
feature_categorical = [
    "payment_method",
    "device_type",
    "ip_country",
    "shipping_state",
    "gender",
    "customer_segment",
    "loyalty_tier",
]
X = df[feature_numeric + feature_categorical]
y = df[label].astype(int)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.25, random_state=42, stratify=y
)

numeric_pipe = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ]
)
categorical_pipe = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("oh", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ]
)
preprocess = ColumnTransformer(
    transformers=[
        ("num", numeric_pipe, feature_numeric),
        ("cat", categorical_pipe, feature_categorical),
    ]
)

selector = SelectFromModel(
    RandomForestClassifier(
        n_estimators=100,
        class_weight="balanced_subsample",
        random_state=42,
        n_jobs=-1,
    ),
    threshold="median",
)
gbrt = GradientBoostingClassifier(random_state=42)
final_pipe = Pipeline(
    steps=[("prep", preprocess), ("select", selector), ("clf", gbrt)]
)
param_dist = {
    "clf__learning_rate": [0.05, 0.1],
    "clf__max_depth": [2, 3],
    "clf__n_estimators": [100, 200],
}
search = RandomizedSearchCV(
    final_pipe,
    param_distributions=param_dist,
    n_iter=4,
    scoring="average_precision",
    cv=3,
    random_state=42,
    n_jobs=-1,
)
search.fit(X_train, y_train)
p = search.best_estimator_.predict_proba(X_test)[:, 1]
print("OK - PR-AUC:", average_precision_score(y_test, p), "ROC-AUC:", roc_auc_score(y_test, p))
