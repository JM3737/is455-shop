import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { queryAll } from "@/lib/sql";
import { PlaceOrderForm } from "./PlaceOrderForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PlaceOrderPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const id = cookies().get("selected_customer_id")?.value;
  if (!id) redirect("/select-customer");

  const products = await queryAll<{
    product_id: number;
    product_name: string;
    price: number;
  }>(
    "SELECT product_id, product_name, price FROM products WHERE is_active = 1 ORDER BY product_name",
  );

  const err = searchParams.error;
  const errMsg =
    err === "no_lines"
      ? "Add at least one line item."
      : err === "bad_product"
        ? "Invalid product selection."
        : err === "db"
          ? "Database error — try again."
          : err === "invalid_json"
            ? "Invalid form data."
            : null;

  if (products.length === 0) {
    return (
      <p className="text-red-600">No active products found in the database.</p>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Place order</h1>
      <p className="text-slate-600">
        Line totals use current product prices. Tax is estimated at 7% of
        subtotal; shipping fee is $9.99.
      </p>
      {errMsg && <p className="text-sm text-red-600">{errMsg}</p>}
      <PlaceOrderForm products={products} />
    </div>
  );
}
