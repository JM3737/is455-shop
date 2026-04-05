import { notFound } from "next/navigation";
import Link from "next/link";
import { queryAll, queryOne } from "@/lib/sql";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OrderDetailPage({
  params,
}: {
  params: { orderId: string };
}) {
  const orderId = Number(params.orderId);
  if (!Number.isFinite(orderId)) notFound();

  const order = await queryOne<Record<string, unknown>>(
    `SELECT o.*, c.full_name
     FROM orders o
     JOIN customers c ON c.customer_id = o.customer_id
     WHERE o.order_id = ?`,
    [orderId],
  );
  if (!order) notFound();

  const items = await queryAll<{
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>(
    `SELECT p.product_name, oi.quantity, oi.unit_price, oi.line_total
     FROM order_items oi
     JOIN products p ON p.product_id = oi.product_id
     WHERE oi.order_id = ?
     ORDER BY oi.order_item_id`,
    [orderId],
  );

  return (
    <div className="space-y-6">
      <Link href="/orders" className="text-sm text-blue-700 underline">
        ← Back to my orders
      </Link>
      <h1 className="text-2xl font-semibold">Order #{orderId}</h1>
      <p className="text-slate-600">
        Customer: {String(order.full_name)} — placed{" "}
        {String(order.order_datetime)}
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Line total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-3 py-2">{r.product_name}</td>
                <td className="px-3 py-2">{r.quantity}</td>
                <td className="px-3 py-2">${r.unit_price.toFixed(2)}</td>
                <td className="px-3 py-2">${r.line_total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-600">
        Order total: ${Number(order.order_total).toFixed(2)}
      </p>
    </div>
  );
}
