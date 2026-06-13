import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { requireAdmin, HttpError } from "../_lib/auth";
import { withErrors, methodNotAllowed, readBody } from "../_lib/http";
import { db, schema } from "../_lib/db";

interface SiteInput {
  name?: string;
  url?: string;
  githubRepo?: string;
  githubBranch?: string;
  contentPath?: string;
  deployHookUrl?: string | null;
  hasBlog?: boolean;
}

export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  await requireAdmin(req);

  // ── GET /api/admin/sites → all sites with assigned client summaries ──
  if (req.method === "GET") {
    const sites = await db.query.sites.findMany({
      orderBy: (s, { asc }) => asc(s.name),
    });

    const assignments = await db
      .select({
        siteId: schema.userSiteAssignments.siteId,
        userId: schema.users.id,
        userName: schema.users.name,
        userEmail: schema.users.email,
      })
      .from(schema.userSiteAssignments)
      .innerJoin(schema.users, eq(schema.userSiteAssignments.userId, schema.users.id));

    const bySite = new Map<string, { id: string; name: string; email: string }[]>();
    for (const a of assignments) {
      const list = bySite.get(a.siteId) ?? [];
      list.push({ id: a.userId, name: a.userName, email: a.userEmail });
      bySite.set(a.siteId, list);
    }

    res.status(200).json(
      sites.map((s) => ({ ...s, clients: bySite.get(s.id) ?? [] }))
    );
    return;
  }

  // ── POST /api/admin/sites → create a site ──
  if (req.method === "POST") {
    const body = readBody<SiteInput>(req);
    if (!body.name || !body.url || !body.githubRepo) {
      throw new HttpError(400, "name, url and githubRepo are required");
    }
    if (!/^[^/]+\/[^/]+$/.test(body.githubRepo)) {
      throw new HttpError(400, 'githubRepo must be in "owner/repo" form');
    }
    const [created] = await db
      .insert(schema.sites)
      .values({
        name: body.name.trim(),
        url: body.url.trim(),
        githubRepo: body.githubRepo.trim(),
        githubBranch: body.githubBranch?.trim() || "main",
        contentPath: body.contentPath?.trim() || "src/content.json",
        deployHookUrl: body.deployHookUrl?.trim() || null,
        hasBlog: Boolean(body.hasBlog),
      })
      .returning();
    res.status(201).json(created);
    return;
  }

  // ── PATCH /api/admin/sites?id=... → update a site ──
  if (req.method === "PATCH") {
    const id = req.query.id as string;
    if (!id) throw new HttpError(400, "id is required");
    const body = readBody<SiteInput>(req);
    if (body.githubRepo && !/^[^/]+\/[^/]+$/.test(body.githubRepo)) {
      throw new HttpError(400, 'githubRepo must be in "owner/repo" form');
    }
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.url !== undefined) patch.url = body.url.trim();
    if (body.githubRepo !== undefined) patch.githubRepo = body.githubRepo.trim();
    if (body.githubBranch !== undefined) patch.githubBranch = body.githubBranch.trim() || "main";
    if (body.contentPath !== undefined)
      patch.contentPath = body.contentPath.trim() || "src/content.json";
    if (body.deployHookUrl !== undefined)
      patch.deployHookUrl = body.deployHookUrl?.trim() || null;
    if (body.hasBlog !== undefined) patch.hasBlog = Boolean(body.hasBlog);

    if (Object.keys(patch).length === 0) throw new HttpError(400, "No fields to update");

    const [updated] = await db
      .update(schema.sites)
      .set(patch)
      .where(eq(schema.sites.id, id))
      .returning();
    if (!updated) throw new HttpError(404, "Site not found");
    res.status(200).json(updated);
    return;
  }

  // ── DELETE /api/admin/sites?id=... ──
  if (req.method === "DELETE") {
    const id = req.query.id as string;
    if (!id) throw new HttpError(400, "id is required");
    const [deleted] = await db
      .delete(schema.sites)
      .where(eq(schema.sites.id, id))
      .returning();
    if (!deleted) throw new HttpError(404, "Site not found");
    res.status(200).json({ deleted: true, id });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
});
