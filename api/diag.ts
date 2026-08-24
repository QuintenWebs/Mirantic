import type { VercelRequest, VercelResponse } from "@vercel/node";

// GET /api/diag → import each dependency of the shared _lib chain in isolation
// and report which one fails. Temporary: /api/ping proves the runtime is fine
// while every real route dies at module load with FUNCTION_INVOCATION_FAILED,
// so the fault is an import, and this narrows it to one. Remove once fixed.
//
// Specifiers are literal so the bundler still traces and includes them.
const checks: Array<[string, () => Promise<unknown>]> = [
  ["jose", () => import("jose")],
  ["drizzle-orm", () => import("drizzle-orm")],
  ["@neondatabase/serverless", () => import("@neondatabase/serverless")],
  ["drizzle-orm/neon-http", () => import("drizzle-orm/neon-http")],
  ["./_lib/schema", () => import("./_lib/schema")],
  ["./_lib/db", () => import("./_lib/db")],
  ["./_lib/auth", () => import("./_lib/auth")],
  ["./_lib/http", () => import("./_lib/http")],
];

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const results = [];
  for (const [name, load] of checks) {
    try {
      await load();
      results.push({ module: name, ok: true });
    } catch (err) {
      results.push({
        module: name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        at: err instanceof Error ? (err.stack || "").split("\n").slice(1, 4) : [],
      });
    }
  }
  res.status(200).json({ node: process.version, results });
}
