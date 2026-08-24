import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { requireUser, HttpError } from "./_lib/auth.js";
import { withErrors, methodNotAllowed, readBody } from "./_lib/http.js";
import { requireSiteAccess } from "./_lib/access.js";
import { db, schema } from "./_lib/db.js";

interface UpsertBody {
  siteId: string;
  field: string;
  changeType?: "field" | "blog_post_add";
  oldValue?: unknown;
  newValue: unknown;
}

export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  const user = await requireUser(req);

  // ── GET /api/changes?siteId=... → unpublished changes for a site ──
  if (req.method === "GET") {
    const siteId = req.query.siteId as string;
    if (!siteId) throw new HttpError(400, "siteId is required");
    await requireSiteAccess(user, siteId);
    const changes = await db.query.pendingChanges.findMany({
      where: and(
        eq(schema.pendingChanges.siteId, siteId),
        eq(schema.pendingChanges.published, false)
      ),
      orderBy: (c, { asc }) => asc(c.createdAt),
    });
    res.status(200).json(changes);
    return;
  }

  // ── POST /api/changes → create or update a pending change ──
  if (req.method === "POST") {
    const body = readBody<UpsertBody>(req);
    if (!body.siteId || !body.field) {
      throw new HttpError(400, "siteId and field are required");
    }
    const access = await requireSiteAccess(user, body.siteId);
    if (!access.canEdit) throw new HttpError(403, "You cannot edit this site");

    const changeType = body.changeType ?? "field";

    // New blog posts are always distinct inserts.
    if (changeType === "blog_post_add") {
      const [created] = await db
        .insert(schema.pendingChanges)
        .values({
          siteId: body.siteId,
          field: body.field,
          changeType: "blog_post_add",
          oldValue: null,
          newValue: body.newValue as object,
          createdById: user.id,
        })
        .returning();
      res.status(201).json(created);
      return;
    }

    // Field edits upsert by (site, field). Editing the same field twice keeps
    // the original oldValue and updates newValue. Reverting deletes the change.
    const existing = await db.query.pendingChanges.findFirst({
      where: and(
        eq(schema.pendingChanges.siteId, body.siteId),
        eq(schema.pendingChanges.field, body.field),
        eq(schema.pendingChanges.changeType, "field"),
        eq(schema.pendingChanges.published, false)
      ),
    });

    if (existing) {
      // Reverted back to the original published value → discard the change.
      if (deepEqual(existing.oldValue, body.newValue)) {
        await db
          .delete(schema.pendingChanges)
          .where(eq(schema.pendingChanges.id, existing.id));
        res.status(200).json({ reverted: true, id: existing.id });
        return;
      }
      const [updated] = await db
        .update(schema.pendingChanges)
        .set({ newValue: body.newValue as object })
        .where(eq(schema.pendingChanges.id, existing.id))
        .returning();
      res.status(200).json(updated);
      return;
    }

    // No-op if nothing actually changed.
    if (deepEqual(body.oldValue ?? null, body.newValue)) {
      res.status(200).json({ noop: true });
      return;
    }

    const [created] = await db
      .insert(schema.pendingChanges)
      .values({
        siteId: body.siteId,
        field: body.field,
        changeType: "field",
        oldValue: (body.oldValue ?? null) as object,
        newValue: body.newValue as object,
        createdById: user.id,
      })
      .returning();
    res.status(201).json(created);
    return;
  }

  // ── DELETE /api/changes?id=... → discard a pending change ──
  if (req.method === "DELETE") {
    const id = req.query.id as string;
    if (!id) throw new HttpError(400, "id is required");
    const change = await db.query.pendingChanges.findFirst({
      where: eq(schema.pendingChanges.id, id),
    });
    if (!change) throw new HttpError(404, "Change not found");
    const access = await requireSiteAccess(user, change.siteId);
    if (!access.canEdit) throw new HttpError(403, "You cannot edit this site");
    await db.delete(schema.pendingChanges).where(eq(schema.pendingChanges.id, id));
    res.status(200).json({ deleted: true, id });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
});

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
