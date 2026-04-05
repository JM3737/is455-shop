"use client";

import { useMemo, useState } from "react";
import { createOrderAction } from "./actions";

type Product = { product_id: number; product_name: string; price: number };

type Line = { product_id: number; quantity: number };

export function PlaceOrderForm({ products }: { products: Product[] }) {
  const [lines, setLines] = useState<Line[]>([
    { product_id: products[0]?.product_id ?? 0, quantity: 1 },
  ]);

  const payload = useMemo(() => JSON.stringify(lines), [lines]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { product_id: products[0]?.product_id ?? 0, quantity: 1 },
    ]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form action={createOrderAction} className="max-w-2xl space-y-4">
      <input type="hidden" name="lines" value={payload} readOnly />
      {lines.map((line, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-white p-3">
          <label className="text-sm">
            <span className="text-slate-600">Product</span>
            <select
              className="mt-1 block w-56 rounded border border-slate-300 px-2 py-1"
              value={line.product_id}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLines((prev) =>
                  prev.map((l, idx) =>
                    idx === i ? { ...l, product_id: v } : l,
                  ),
                );
              }}
            >
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.product_name} (${p.price.toFixed(2)})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Qty</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-24 rounded border border-slate-300 px-2 py-1"
              value={line.quantity}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value) || 1);
                setLines((prev) =>
                  prev.map((l, idx) =>
                    idx === i ? { ...l, quantity: v } : l,
                  ),
                );
              }}
            />
          </label>
          {lines.length > 1 && (
            <button
              type="button"
              className="text-sm text-red-600 underline"
              onClick={() => removeLine(i)}
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={addLine}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          Add line
        </button>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
        >
          Submit order
        </button>
      </div>
    </form>
  );
}
