import Link from "next/link";

const links = [
  { href: "/select-customer", label: "Select Customer" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/place-order", label: "Place Order" },
  { href: "/orders", label: "My Orders" },
  { href: "/admin/orders", label: "Admin: All Orders" },
  { href: "/warehouse/priority", label: "Warehouse Priority" },
  { href: "/scoring", label: "Run Scoring" },
  { href: "/debug/schema", label: "Debug Schema" },
];

export function Nav() {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 py-3 text-sm">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
