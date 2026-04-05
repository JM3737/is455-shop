import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Shop — ML deployment demo</h1>
      <p className="text-slate-600">
        Chapter 17 workflow: select a customer, place orders, run Python
        inference to refresh <code>order_predictions</code>, then open the
        warehouse priority queue.
      </p>
      <Link
        href="/select-customer"
        className="inline-block rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
      >
        Start → Select Customer
      </Link>
    </div>
  );
}
