import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getInferenceScriptPath, getProjectRoot } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

function pickPython(): string {
  return process.env.PYTHON_PATH || (process.platform === "win32" ? "py" : "python3");
}

/**
 * On Vercel, delegates to the Python serverless function at /api/inference.
 * Locally (plain `next dev`), runs `jobs/run_inference.py` so you do not need `vercel dev`.
 */
export async function POST() {
  if (process.env.VERCEL) {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? "https";
    const url = `${proto}://${host}/api/inference`;
    const res = await fetch(url, { method: "POST" });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  }

  const script = getInferenceScriptPath();
  const root = getProjectRoot();
  if (!fs.existsSync(script)) {
    return NextResponse.json(
      { ok: false, error: `Inference script not found: ${script}` },
      { status: 500 },
    );
  }

  const py = pickPython();
  const usePyLauncher = process.platform === "win32" && py === "py";
  const executable = usePyLauncher ? py : py;
  const args = usePyLauncher ? ["-3", script] : [script];

  try {
    const { stdout, stderr } = await execFileAsync(executable, args, {
      cwd: root,
      timeout: 120_000,
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: "1" },
    });
    const text = [stdout, stderr].filter(Boolean).join("\n").trim();
    const match = text.match(/Predictions written:\s*(\d+)/i);
    const scored = match ? Number(match[1]) : undefined;
    return NextResponse.json({
      ok: true,
      stdout: text,
      scored,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Python inference failed",
        stdout: e?.stdout,
        stderr: e?.stderr,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
