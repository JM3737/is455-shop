import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { queryAll, queryOne } from "@/lib/sql";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DashboardPage() {
  const id = cookies().get("selected_customer_id")?.value;
  if (!id) redirect("/select-customer");

  const cust = await queryOne<{
    customer_id: number;
    full_name: string;
    email: string;
  }>(
    "SELECT customer_id, full_name, email FROM customers WHERE customer_id = ?",
    [Number(id)],
  );
  if (!cust) redirect("/select-customer");

  const stats = await queryOne<{ n: number; spend: number }>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(order_total),0) AS spend
     FROM orders WHERE customer_id = ?`,
    [Number(id)],
  );

  const recent = await queryAll<{
    order_id: number;
    order_datetime: string;
    order_total: number;
    shipped: number;
  }>(
    `SELECT o.order_id, o.order_datetime, o.order_total,
            CASE WHEN s.shipment_id IS NOT NULL THEN 1 ELSE 0 END AS shipped
     FROM orders o
     LEFT JOIN shipments s ON s.order_id = o.order_id
     WHERE o.customer_id = ?
     ORDER BY o.order_datetime DESC
     LIMIT 5`,
    [Number(id)],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customer dashboard</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="font-medium">{cust.full_name}</p>
        <p className="text-sm text-slate-600">{cust.email}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">Total orders</dt>
          <dd className="font-medium">{stats?.n ?? 0}</dd>
          <dt className="text-slate-500">Lifetime spend</dt>
          <dd className="font-medium">
            ${Number(stats?.spend ?? 0).toFixed(2)}
          </dd>
        </dl>
      </div>
      <div>
        <h2 className="mb-2 text-lg font-medium">Five most recent orders</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Shipped</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.order_id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <Link
                      href={`/orders/${r.order_id}`}
                      className="text-blue-700 underline"
                    >
                      {r.order_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.order_datetime}</td>
                  <td className="px-3 py-2">
                    ${Number(r.order_total).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">{r.shipped ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Link href="/place-order" className="text-blue-700 underline">
        Place a new order →
      </Link>
    </div>
  );
}
