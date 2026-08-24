import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../_lib/auth.js";
import { withErrors, methodNotAllowed } from "../_lib/http.js";
import { db, schema } from "../_lib/db.js";

// GET /api/admin/dashboard → high-level counts for the admin overview.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  await requireAdmin(req);

  const [clientCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.users)
    .where(eq(schema.users.role, "client"));

  const [siteCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.sites);

  const sitesWithPending = await db
    .selectDistinct({ siteId: schema.pendingChanges.siteId })
    .from(schema.pendingChanges)
    .where(eq(schema.pendingChanges.published, false));

  res.status(200).json({
    clients: clientCount?.n ?? 0,
    sites: siteCount?.n ?? 0,
    sitesWithPendingChanges: sitesWithPending.length,
  });
});
