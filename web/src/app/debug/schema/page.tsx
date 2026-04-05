import { getSqlClient, rowsAsObjects } from "@/lib/sql";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DebugSchemaPage() {
  const client = getSqlClient();
  const tablesRs = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const tables = rowsAsObjects<{ name: string }>(tablesRs);

  const info: { name: string; columns: unknown[] }[] = [];
  for (const t of tables) {
    const colRs = await client.execute(`PRAGMA table_info(${t.name})`);
    info.push({ name: t.name, columns: rowsAsObjects(colRs) });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Debug: schema</h1>
      <p className="text-sm text-slate-600">
        Tables in the configured database (local file or Turso).
      </p>
      <div className="space-y-6">
        {info.map((t) => (
          <div
            key={t.name}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <h2 className="font-mono text-lg font-medium">{t.name}</h2>
            <pre className="mt-2 overflow-x-auto text-xs text-slate-800">
              {JSON.stringify(t.columns, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
