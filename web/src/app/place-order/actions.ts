"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSqlClient, queryOne, rowsAsObjects } from "@/lib/sql";

type Line = { product_id: number; quantity: number };

export async function createOrderAction(formData: FormData) {
  const cid = cookies().get("selected_customer_id")?.value;
  if (!cid) redirect("/select-customer");

  const raw = formData.get("lines");
  let lines: Line[] = [];
  try {
    lines = JSON.parse(String(raw || "[]")) as Line[];
  } catch {
    redirect("/place-order?error=invalid_json");
  }
  lines = lines.filter(
    (l) =>
      l &&
      Number.isFinite(l.product_id) &&
      l.product_id > 0 &&
      Number.isFinite(l.quantity) &&
      l.quantity > 0,
  );
  if (lines.length === 0) redirect("/place-order?error=no_lines");

  const customer = await queryOne<{
    zip_code: string | null;
    state: string | null;
  }>("SELECT zip_code, state FROM customers WHERE customer_id = ?", [
    Number(cid),
  ]);
  if (!customer) redirect("/select-customer");

  const zip = customer.zip_code || "00000";
  const state = customer.state || "NA";

  let subtotal = 0;
  const resolved: { product_id: number; quantity: number; unit: number }[] =
    [];
  for (const l of lines) {
    const p = await queryOne<{ product_id: number; price: number }>(
      "SELECT product_id, price FROM products WHERE product_id = ? AND is_active = 1",
      [l.product_id],
    );
    if (!p) redirect("/place-order?error=bad_product");
    subtotal += p.price * l.quantity;
    resolved.push({
      product_id: p.product_id,
      quantity: l.quantity,
      unit: p.price,
    });
  }

  const shippingFee = 9.99;
  const taxAmount = Math.round(subtotal * 0.07 * 100) / 100;
  const orderTotal =
    Math.round((subtotal + shippingFee + taxAmount) * 100) / 100;

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  const client = getSqlClient();
  const maxRs = await client.execute({
    sql: "SELECT COALESCE(MAX(order_id), 0) + 1 AS n FROM orders",
    args: [],
  });
  const nextId = Number(rowsAsObjects<{ n: number }>(maxRs)[0]?.n ?? 1);

  const tx = await client.transaction("write");
  try {
    await tx.execute({
      sql: `INSERT INTO orders (
        order_id, customer_id, order_datetime,
        billing_zip, shipping_zip, shipping_state,
        payment_method, device_type, ip_country,
        promo_used, promo_code,
        order_subtotal, shipping_fee, tax_amount, order_total,
        risk_score, is_fraud
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        nextId,
        Number(cid),
        now,
        zip,
        zip,
        state,
        "card",
        "web",
        "US",
        0,
        null,
        subtotal,
        shippingFee,
        taxAmount,
        orderTotal,
        0,
        0,
      ],
    });
    for (const r of resolved) {
      const lt = Math.round(r.unit * r.quantity * 100) / 100;
      await tx.execute({
        sql: `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
         VALUES (?,?,?,?,?)`,
        args: [nextId, r.product_id, r.quantity, r.unit, lt],
      });
    }
    await tx.commit();
  } catch {
    await tx.rollback();
    redirect("/place-order?error=db");
  }

  redirect(`/orders?placed=${nextId}`);
}
