import { selectCustomerAction } from "@/app/actions/customer";
import { queryAll } from "@/lib/sql";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = { customer_id: number; full_name: string; email: string };

export default async function SelectCustomerPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const customers = await queryAll<Row>(
    "SELECT customer_id, full_name, email FROM customers WHERE is_active = 1 ORDER BY full_name",
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Select Customer</h1>
      <p className="text-slate-600">
        No login — choose an existing customer to act as for this session.
      </p>
      {searchParams.error === "invalid" && (
        <p className="text-sm text-red-600">Please choose a valid customer.</p>
      )}
      <form action={selectCustomerAction} className="max-w-md space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Customer
          <select
            name="customer_id"
            required
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {customers.map((c) => (
              <option key={c.customer_id} value={c.customer_id}>
                {c.full_name} — {c.email}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
        >
          Continue to dashboard
        </button>
      </form>
    </div>
  );
}
