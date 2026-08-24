import type { VercelRequest, VercelResponse } from "@vercel/node";

// GET /api/ping → liveness check with no imports beyond the runtime types.
// Answers "is the serverless runtime itself healthy?" independently of the
// database, Auth0 and GitHub wiring the other routes depend on.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, node: process.version });
}
