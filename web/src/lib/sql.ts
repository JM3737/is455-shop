import { createClient, type Client, type ResultSet, type Row } from "@libsql/client";
import fs from "fs";
import { pathToFileURL } from "url";
import { getShopDbPath } from "./paths";

let _client: Client | null = null;

export function getSqlClient(): Client {
  if (_client) return _client;

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    _client = createClient({
      url: tursoUrl,
      authToken: tursoToken,
      intMode: "number",
    });
    return _client;
  }

  const p = getShopDbPath();
  if (!fs.existsSync(p)) {
    throw new Error(
      `Database not found at ${p}. For Vercel, set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.`,
    );
  }

  _client = createClient({
    url: pathToFileURL(p).href,
    intMode: "number",
  });
  return _client;
}

/** Convert libsql rows to plain objects with numbers instead of bigint. */
export function rowsAsObjects<T extends Record<string, unknown>>(
  rs: ResultSet,
): T[] {
  return rs.rows.map((row) => {
    const o: Record<string, unknown> = {};
    for (const col of rs.columns) {
      const v = row[col as keyof Row] as unknown;
      o[col] = typeof v === "bigint" ? Number(v) : v;
    }
    return o as T;
  });
}

export async function queryAll<T extends Record<string, unknown>>(
  sql: string,
  args: (string | number | null)[] = [],
): Promise<T[]> {
  const rs = await getSqlClient().execute({ sql, args });
  return rowsAsObjects<T>(rs);
}

export async function queryOne<T extends Record<string, unknown>>(
  sql: string,
  args: (string | number | null)[] = [],
): Promise<T | null> {
  const rows = await queryAll<T>(sql, args);
  return rows[0] ?? null;
}
