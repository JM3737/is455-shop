# IS 455 — Chapter 17 Assignment (both parts)

This repo contains:

- **`web/`** — Next.js app (Select Customer, place order, customer orders, **admin all-orders**, warehouse priority queue, **Run Scoring**).
- **`jobs/`** — Python ETL, training, and inference for **late delivery** (Chapter 17).
- **`data/shop.db`** — Operational SQLite DB (you already have this file).
- **`notebooks/is_fraud_crisp_dm.ipynb`** — Part 2: full **CRISP-DM** notebook for **`is_fraud`**.

---

## Part 1 — Run locally (required for full functionality)

### 1. One-time Python setup

From the **repo root** (`040426/`):

```bash
pip install -r requirements.txt
python jobs/etl_build_warehouse.py
python jobs/train_model.py
python jobs/run_inference.py
```

That creates `data/warehouse.db`, `artifacts/late_delivery_model.sav`, and seeds `order_predictions` (200 rows if every order is already shipped).

### 2. Web app

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Checklist**

1. **Select Customer** → pick a customer.
2. **Place Order** → add line items; order is written to `shop.db`.
3. **Run Scoring** → runs `python`/`py` on `jobs/run_inference.py` at the repo root (needs Python on `PATH`). Then open **Warehouse Priority** — new **unshipped** orders should appear sorted by `late_delivery_probability`.
4. **Admin: All Orders** — system-wide order history.

If scoring fails on Windows, set in `web/.env.local`:

```env
PYTHON_PATH=py
```

(or the full path to `python.exe`).

---

## Part 1 — Deploy to Vercel (this project is wired for it)

The app uses:

- **[@libsql/client](https://github.com/tursodatabase/libsql-client-ts)** in Next.js — local `data/shop.db` via `file:` URLs, or **Turso** in production.
- **`web/api/inference.py`** — Vercel **Python** serverless function (sklearn + joblib + `libsql` sync) for **Run Scoring**.
- **`npm run build`** copies `../artifacts/late_delivery_model.sav` → `web/ml/` (commit that `.sav` if it is not in Git, so Vercel builds can score).

### 1. Turso (hosted SQLite — required on Vercel)

Vercel cannot keep a writable `shop.db` file on disk the way your laptop does. Create a **Turso** database and load your data:

1. Install CLI: [Turso CLI](https://docs.turso.tech/cli/introduction) (`brew install tursodatabase/tap/turso` or see docs).
2. `turso auth login`
3. `turso db create is455-shop` (name is up to you).
4. Import `data/shop.db` using the method Turso documents for SQLite imports (e.g. SQL dump or `turso db import` if your CLI version supports it). You need the same tables as in the course file (`orders`, `customers`, `order_items`, `products`, `shipments`, etc.).
5. Create a DB token and copy:
   - **URL** → `libsql://...` (from `turso db show --url is455-shop`)
   - **Token** → `TURSO_AUTH_TOKEN` (from `turso db tokens create is455-shop`)

### 2. GitHub + Vercel

1. Push this repo to GitHub (include `data/shop.db` only if your course allows — otherwise rely on Turso as the source of truth after import).
2. [vercel.com](https://vercel.com) → **Add New Project** → import the repo.
3. Set **Root Directory** to **`web`**.
4. **Environment variables** (Production + Preview):

   | Name | Value |
   |------|--------|
   | `TURSO_DATABASE_URL` | `libsql://...` from Turso |
   | `TURSO_AUTH_TOKEN` | token string |

5. Deploy. After the first deploy, run **Redeploy** if you add env vars.

### 3. Model file on Vercel

- Run `python jobs/train_model.py` locally, then `cd web && npm run build` once so `web/ml/late_delivery_model.sav` exists.
- **Commit `web/ml/late_delivery_model.sav`** to Git so production builds always have the artifact (it is small for a logistic pipeline).

### 4. Test like production locally

```bash
cd web
npx vercel dev
```

This runs Next.js **and** the Python `/api/inference` route. Set the same `TURSO_*` variables in `.env.local` under `web/` if you want to hit Turso from `vercel dev`.

### 5. How scoring routes work

- **`next dev` (local):** `POST /api/scoring` runs `jobs/run_inference.py` with subprocess (your original flow).
- **Vercel:** `POST /api/scoring` forwards to **`/api/inference`** (Python), which syncs Turso ↔ `/tmp`, runs pandas/sklearn, writes `order_predictions`, then syncs back.

---

## Part 2 — Notebook

1. Install notebook extras (if needed):

   ```bash
   pip install matplotlib seaborn jupyter
   ```

2. Open `notebooks/is_fraud_crisp_dm.ipynb` in Jupyter or VS Code.
3. **Kernel:** use the same environment where `pandas` and `scikit-learn` are installed.
4. Run all cells; confirm `artifacts/fraud_model_pipeline.sav` and `artifacts/fraud_model_metadata.json` are produced.

Submit the **`.ipynb`** file as instructed.

---

## Project layout

```
040426/
  data/
    shop.db
    warehouse.db          # created by ETL
  artifacts/              # models + JSON metadata
  jobs/
    config.py
    utils_db.py
    etl_build_warehouse.py
    train_model.py
    run_inference.py
  notebooks/
    is_fraud_crisp_dm.ipynb
  web/                    # Next.js (Vercel root = this folder)
    api/inference.py      # Python scoring on Vercel
    ml/late_delivery_model.sav   # commit after train + prebuild
  scripts/                # helpers (inspect_db, smoke tests)
```

---

## Troubleshooting

| Issue | Fix |
|--------|-----|
| `Database not found` | Ensure `data/shop.db` exists; or set `SHOP_DB_PATH` in `web/.env.local`. |
| Priority queue empty | Only **unshipped** orders appear. Place a **new** order (no shipment row), then **Run Scoring**. |
| Scoring API 500 | Run `python jobs/run_inference.py` manually from repo root; fix any error shown. Train the model first. |
| `order_predictions` missing | Inference creates the table automatically on first successful run. |
