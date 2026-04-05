import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");
const repoRoot = join(webRoot, "..");
const src = join(repoRoot, "artifacts", "late_delivery_model.sav");
const destDir = join(webRoot, "ml");
const dest = join(destDir, "late_delivery_model.sav");

mkdirSync(destDir, { recursive: true });
if (existsSync(src)) {
  copyFileSync(src, dest);
  console.log("Copied late_delivery_model.sav -> web/ml/");
} else {
  console.warn(
    "artifacts/late_delivery_model.sav not found — run: python jobs/train_model.py",
  );
}
