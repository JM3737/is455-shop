import fs from "fs";
import path from "path";

/**
 * Root of the monorepo (parent of /web). Used to locate data/ and jobs/.
 */
export function getProjectRoot(): string {
  const env = process.env.PROJECT_ROOT;
  if (env && fs.existsSync(env)) return env;
  return path.resolve(process.cwd(), "..");
}

export function getShopDbPath(): string {
  const env = process.env.SHOP_DB_PATH;
  if (env) return env;
  return path.join(getProjectRoot(), "data", "shop.db");
}

export function getInferenceScriptPath(): string {
  return path.join(getProjectRoot(), "jobs", "run_inference.py");
}
