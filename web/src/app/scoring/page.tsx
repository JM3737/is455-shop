"use client";

import { useState } from "react";
import Link from "next/link";

export default function ScoringPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/scoring", { method: "POST" });
      const data = (await res.json()) as {
        ok: boolean;
        stdout?: string;
        error?: string;
        scored?: number;
        timestamp?: string;
      };
      if (data.ok) {
        setResult(
          `Success at ${data.timestamp}\nScored: ${data.scored ?? "?"}\n\n${data.stdout ?? ""}`,
        );
      } else {
        setResult(
          `Failed: ${data.error ?? "unknown"}\n${data.stdout ?? ""}\n${(data as { stderr?: string }).stderr ?? ""}`,
        );
      }
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Run scoring</h1>
      <p className="text-slate-600">
        Executes <code className="rounded bg-slate-100 px-1">jobs/run_inference.py</code>{" "}
        at the project root (same machine as this server). After it finishes,
        open the{" "}
        <Link href="/warehouse/priority" className="text-blue-700 underline">
          warehouse priority queue
        </Link>
        .
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={run}
        className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Running…" : "Run Scoring"}
      </button>
      {result && (
        <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-800">
          {result}
        </pre>
      )}
    </div>
  );
}
