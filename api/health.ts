import type { VercelRequest, VercelResponse } from "@vercel/node";

// GET /api/health → is this deployment actually configured and able to reach
// its database? Reports only whether each variable is PRESENT — never a value.
// Kept as a permanent check: a misconfigured env var is otherwise invisible
// until a user hits a real route and gets a 500.
const REQUIRED = [
  "DATABASE_URL",
  "AUTH0_DOMAIN",
  "AUTH0_AUDIENCE",
  "AUTH0_M2M_CLIENT_ID",
  "AUTH0_M2M_CLIENT_SECRET",
] as const;

const OPTIONAL = ["GITHUB_TOKEN", "BLOB_READ_WRITE_TOKEN", "APP_URL"] as const;

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const env: Record<string, boolean> = {};
  for (const k of [...REQUIRED, ...OPTIONAL]) env[k] = Boolean(process.env[k]);
  const missing = REQUIRED.filter((k) => !process.env[k]);

  let database: { ok: boolean; detail?: string } = { ok: false, detail: "not attempted" };
  if (process.env.DATABASE_URL) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`select 1 as ok`;
      database = { ok: rows.length === 1 };
    } catch (err) {
      database = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  }

  res.status(missing.length === 0 && database.ok ? 200 : 503).json({
    ok: missing.length === 0 && database.ok,
    node: process.version,
    env,
    missing,
    database,
  });
}
