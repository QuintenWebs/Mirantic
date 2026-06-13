import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { requireAdmin, HttpError } from "../_lib/auth";
import { withErrors, methodNotAllowed, readBody } from "../_lib/http";
import { db, schema } from "../_lib/db";
import { createClientUser, deleteAuth0User } from "../_lib/auth0-management";

interface ClientWithSites {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  sites: { id: string; name: string; canEdit: boolean; canPublish: boolean }[];
}

export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  await requireAdmin(req);

  // ── GET /api/admin/clients[?id=] ──
  if (req.method === "GET") {
    const id = req.query.id as string | undefined;
    const clients = await db.query.users.findMany({
      where: id ? eq(schema.users.id, id) : eq(schema.users.role, "client"),
      orderBy: (u, { asc }) => asc(u.name),
    });

    const assignments = await db
      .select({
        userId: schema.userSiteAssignments.userId,
        canEdit: schema.userSiteAssignments.canEdit,
        canPublish: schema.userSiteAssignments.canPublish,
        siteId: schema.sites.id,
        siteName: schema.sites.name,
      })
      .from(schema.userSiteAssignments)
      .innerJoin(schema.sites, eq(schema.userSiteAssignments.siteId, schema.sites.id));

    const byUser = new Map<string, ClientWithSites["sites"]>();
    for (const a of assignments) {
      const list = byUser.get(a.userId) ?? [];
      list.push({
        id: a.siteId,
        name: a.siteName,
        canEdit: a.canEdit,
        canPublish: a.canPublish,
      });
      byUser.set(a.userId, list);
    }

    const result: ClientWithSites[] = clients.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      role: c.role,
      createdAt: c.createdAt,
      sites: byUser.get(c.id) ?? [],
    }));

    if (id) {
      if (result.length === 0) throw new HttpError(404, "Client not found");
      res.status(200).json(result[0]);
      return;
    }
    res.status(200).json(result);
    return;
  }

  // ── POST /api/admin/clients → create Auth0 user + DB row + invite link ──
  if (req.method === "POST") {
    const { name, email } = readBody<{ name: string; email: string }>(req);
    if (!email) throw new HttpError(400, "email is required");

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, normalizedEmail),
    });
    if (existing) throw new HttpError(409, "A user with this email already exists");

    const { user: auth0User, inviteUrl } = await createClientUser(
      normalizedEmail,
      name?.trim() ?? ""
    );

    const [created] = await db
      .insert(schema.users)
      .values({
        auth0Id: auth0User.auth0Id,
        email: normalizedEmail,
        name: name?.trim() || auth0User.name || normalizedEmail,
        role: "client",
      })
      .returning();

    res.status(201).json({ client: created, inviteUrl });
    return;
  }

  // ── DELETE /api/admin/clients?id=... ──
  if (req.method === "DELETE") {
    const id = req.query.id as string;
    if (!id) throw new HttpError(400, "id is required");
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, id),
    });
    if (!user) throw new HttpError(404, "Client not found");
    if (user.role === "admin") throw new HttpError(400, "Cannot delete the admin user");

    // Remove from Auth0 first; tolerate already-deleted.
    if (user.auth0Id) await deleteAuth0User(user.auth0Id);
    // DB cascade removes assignments.
    await db.delete(schema.users).where(eq(schema.users.id, id));
    res.status(200).json({ deleted: true, id });
    return;
  }

  return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
});
