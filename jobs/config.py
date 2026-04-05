from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts"
OP_DB_PATH = DATA_DIR / "shop.db"
WH_DB_PATH = DATA_DIR / "warehouse.db"
MODEL_PATH = ARTIFACTS_DIR / "late_delivery_model.sav"
MODEL_METADATA_PATH = ARTIFACTS_DIR / "model_metadata.json"
METRICS_PATH = ARTIFACTS_DIR / "metrics.json"

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
