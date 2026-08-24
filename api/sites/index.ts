import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { requireUser } from "../_lib/auth.js";
import { withErrors, methodNotAllowed } from "../_lib/http.js";
import { db, schema } from "../_lib/db.js";

// GET /api/sites[?as=client] → sites the current user can access.
// Admin sees all sites; clients see only assigned sites. An admin viewing as a
// client passes ?as=client to get their own assignments instead of everything,
// so "view as client" shows what that client actually sees.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const user = await requireUser(req);
  const asClient = req.query.as === "client";

  if (user.role === "admin" && !asClient) {
    const all = await db.query.sites.findMany({
      orderBy: (s, { asc }) => asc(s.name),
    });
    res.status(200).json(all.map((s) => ({ ...s, canEdit: true, canPublish: true })));
    return;
  }

  const assignments = await db
    .select({
      site: schema.sites,
      canEdit: schema.userSiteAssignments.canEdit,
      canPublish: schema.userSiteAssignments.canPublish,
    })
    .from(schema.userSiteAssignments)
    .innerJoin(schema.sites, eq(schema.userSiteAssignments.siteId, schema.sites.id))
    .where(eq(schema.userSiteAssignments.userId, user.id));

  res.status(200).json(
    assignments
      .map((a) => ({ ...a.site, canEdit: a.canEdit, canPublish: a.canPublish }))
      .sort((a, b) => a.name.localeCompare(b.name))
  );
});
