import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { requireAdmin, HttpError } from "../_lib/auth.js";
import { withErrors, methodNotAllowed, readBody } from "../_lib/http.js";
import { db, schema } from "../_lib/db.js";

interface AssignBody {
  userId: string;
  siteId: string;
  canEdit?: boolean;
  canPublish?: boolean;
}

// Assign or unassign a client to a site.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  await requireAdmin(req);

  // ── POST → create or update an assignment (upsert) ──
  if (req.method === "POST") {
    const body = readBody<AssignBody>(req);
    if (!body.userId || !body.siteId) {
      throw new HttpError(400, "userId and siteId are required");
    }
    const canEdit = body.canEdit ?? true;
    const canPublish = body.canPublish ?? true;

    const existing = await db.query.userSiteAssignments.findFirst({
      where: and(
        eq(schema.userSiteAssignments.userId, body.userId),
        eq(schema.userSiteAssignments.siteId, body.siteId)
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(schema.userSiteAssignments)
        .set({ canEdit, canPublish })
        .where(eq(schema.userSiteAssignments.id, existing.id))
        .returning();
      res.status(200).json(updated);
      return;
    }

    const [created] = await db
      .insert(schema.userSiteAssignments)
      .values({ userId: body.userId, siteId: body.siteId, canEdit, canPublish })
      .returning();
    res.status(201).json(created);
    return;
  }

  // ── DELETE ?userId=&siteId= → remove an assignment ──
  if (req.method === "DELETE") {
    const userId = req.query.userId as string;
    const siteId = req.query.siteId as string;
    if (!userId || !siteId) throw new HttpError(400, "userId and siteId are required");
    await db
      .delete(schema.userSiteAssignments)
      .where(
        and(
          eq(schema.userSiteAssignments.userId, userId),
          eq(schema.userSiteAssignments.siteId, siteId)
        )
      );
    res.status(200).json({ deleted: true });
    return;
  }

  return methodNotAllowed(res, ["POST", "DELETE"]);
});
