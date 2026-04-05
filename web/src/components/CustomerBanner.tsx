import { cookies } from "next/headers";
import { queryOne } from "@/lib/sql";

export async function CustomerBanner() {
  const id = cookies().get("selected_customer_id")?.value;
  if (!id) {
    return (
      <div className="bg-amber-50 px-4 py-2 text-sm text-amber-900">
        No customer selected — go to{" "}
        <a href="/select-customer" className="underline">
          Select Customer
        </a>
        .
      </div>
    );
  }
  let label = `Customer #${id}`;
  try {
    const row = await queryOne<{ full_name: string; email: string }>(
      "SELECT full_name, email FROM customers WHERE customer_id = ?",
      [Number(id)],
    );
    if (row) label = `${row.full_name} (${row.email})`;
  } catch {
    /* ignore */
  }
  return (
    <div className="bg-slate-100 px-4 py-2 text-sm text-slate-800">
      Acting as: <strong>{label}</strong>
    </div>
  );
}
