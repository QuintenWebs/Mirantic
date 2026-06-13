import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { requireUser } from "../_lib/auth";
import { withErrors, methodNotAllowed } from "../_lib/http";
import { db, schema } from "../_lib/db";

// GET /api/sites → sites the current user can access.
// Admin sees all sites; clients see only assigned sites.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const user = await requireUser(req);

  if (user.role === "admin") {
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
