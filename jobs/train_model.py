import json
from datetime import datetime, timezone

import joblib
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from config import (
    ARTIFACTS_DIR,
    FEATURE_COLS,
    METRICS_PATH,
    MODEL_METADATA_PATH,
    MODEL_PATH,
    WH_DB_PATH,
)
from utils_db import sqlite_conn

MODEL_VERSION = "1.0.0"
LABEL_COL = "late_delivery"


def train_and_save() -> None:
    with sqlite_conn(WH_DB_PATH) as conn:
        df = pd.read_sql("SELECT * FROM fact_orders_ml", conn)

    X = df[FEATURE_COLS]
    y = df[LABEL_COL].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    model = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("model", LogisticRegression(max_iter=1000)),
        ]
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "f1": float(f1_score(y_test, y_pred)),
        "roc_auc": float(roc_auc_score(y_test, y_prob)),
        "row_count_train": int(len(X_train)),
        "row_count_test": int(len(X_test)),
    }

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    metadata = {
        "model_name": "late_delivery_pipeline",
        "model_version": MODEL_VERSION,
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "warehouse_table": "fact_orders_ml",
        "num_training_rows": int(len(X_train)),
        "num_test_rows": int(len(X_test)),
        "features": FEATURE_COLS,
        "label": LABEL_COL,
    }

    with open(MODEL_METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print("Training complete.")
    print(f"Saved model: {MODEL_PATH}")
    print(f"Saved metadata: {MODEL_METADATA_PATH}")
    print(f"Saved metrics: {METRICS_PATH}")


if __name__ == "__main__":
    train_and_save()
