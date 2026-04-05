import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { queryAll } from "@/lib/sql";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { placed?: string };
}) {
  const id = cookies().get("selected_customer_id")?.value;
  if (!id) redirect("/select-customer");

  const rows = await queryAll<{
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
     ORDER BY o.order_datetime DESC`,
    [Number(id)],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My order history</h1>
      {searchParams.placed && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Order #{searchParams.placed} was placed successfully.
        </p>
      )}
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
