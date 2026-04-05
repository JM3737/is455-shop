import Link from "next/link";
import { queryAll } from "@/lib/sql";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const QUERY = `
SELECT
  o.order_id,
  o.order_datetime,
  o.order_total,
  c.customer_id,
  c.full_name AS customer_name,
  p.late_delivery_probability,
  p.predicted_late_delivery,
  p.prediction_timestamp
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
JOIN order_predictions p ON p.order_id = o.order_id
LEFT JOIN shipments s ON s.order_id = o.order_id
WHERE s.shipment_id IS NULL
ORDER BY p.late_delivery_probability DESC, o.order_datetime ASC
LIMIT 50
`;

export default async function WarehousePriorityPage() {
  let rows: Record<string, unknown>[] = [];
  let error: string | null = null;
  try {
    rows = await queryAll<Record<string, unknown>>(QUERY);
  } catch (e) {
    error =
      e instanceof Error
        ? e.message
        : "Failed to run priority query (is order_predictions missing?)";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Late delivery priority queue</h1>
      <p className="text-slate-600">
        Orders are ranked by predicted late-delivery risk so the warehouse can
        verify or expedite the riskiest unshipped orders first. Predictions come
        from the ML pipeline (
        <code className="rounded bg-slate-100 px-1">order_predictions</code>
        ). If every order already has a shipment row, this list may be empty
        until you add new orders and run scoring.
      </p>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {!error && rows.length === 0 && (
        <p className="text-sm text-amber-800">
          No unshipped orders with predictions. Place a new order, then go to{" "}
          <Link href="/scoring" className="underline">
            Run Scoring
          </Link>
          .
        </p>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">P(late)</th>
                <th className="px-3 py-2">Pred</th>
                <th className="px-3 py-2">Scored at</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={String(r.order_id)}
                  className="border-t border-slate-100"
                >
                  <td className="px-3 py-2">{String(r.order_id)}</td>
                  <td className="px-3 py-2">{String(r.order_datetime)}</td>
                  <td className="px-3 py-2">
                    ${Number(r.order_total).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">{String(r.customer_name)}</td>
                  <td className="px-3 py-2">
                    {Number(r.late_delivery_probability).toFixed(4)}
                  </td>
                  <td className="px-3 py-2">
                    {String(r.predicted_late_delivery)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {String(r.prediction_timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
