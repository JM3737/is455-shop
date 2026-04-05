import Link from "next/link";
import { queryAll } from "@/lib/sql";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AdminOrdersPage() {
  const rows = await queryAll<{
    order_id: number;
    order_datetime: string;
    order_total: number;
    customer_id: number;
    customer_name: string;
    shipped: number;
  }>(
    `SELECT o.order_id, o.order_datetime, o.order_total, o.customer_id,
            c.full_name AS customer_name,
            CASE WHEN s.shipment_id IS NOT NULL THEN 1 ELSE 0 END AS shipped
     FROM orders o
     JOIN customers c ON c.customer_id = o.customer_id
     LEFT JOIN shipments s ON s.order_id = o.order_id
     ORDER BY o.order_datetime DESC
     LIMIT 500`,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Administrator — all orders</h1>
      <p className="text-slate-600">
        System-wide order history (most recent 500). Use this to monitor
        activity across customers.
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Shipped</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.order_id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <Link
                    href={`/orders/${r.order_id}`}
                    className="text-blue-700 underline"
                  >
                    {r.order_id}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  #{r.customer_id} — {r.customer_name}
                </td>
                <td className="px-3 py-2">{r.order_datetime}</td>
                <td className="px-3 py-2">${Number(r.order_total).toFixed(2)}</td>
                <td className="px-3 py-2">{r.shipped ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
