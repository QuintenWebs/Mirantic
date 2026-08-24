import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { requireAdmin, HttpError } from "../_lib/auth.js";
import { withErrors, methodNotAllowed, readBody } from "../_lib/http.js";
import { db, schema } from "../_lib/db.js";
import {
  createClientUser,
  createInviteTicket,
  deleteAuth0User,
} from "../_lib/auth0-management.js";
import { sendInviteEmail } from "../_lib/email.js";

interface ClientWithSites {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  active: boolean;
  sites: { id: string; name: string; canEdit: boolean; canPublish: boolean }[];
}

export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  const admin = await requireAdmin(req);

  // ── GET /api/admin/clients[?id=] ──
  if (req.method === "GET") {
    const id = req.query.id as string | undefined;
    const clients = await db.query.users.findMany({
      where: id ? eq(schema.users.id, id) : undefined,
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
      active: c.active,
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

  // ── POST /api/admin/clients?id=...&action=resend → new invite link + email ──
  if (req.method === "POST" && req.query.action === "resend") {
    const id = req.query.id as string;
    if (!id) throw new HttpError(400, "id is required");
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
    if (!user) throw new HttpError(404, "Client not found");
    if (!user.auth0Id) throw new HttpError(400, "This client has no Auth0 account to invite");

    const inviteUrl = await createInviteTicket(user.auth0Id);
    const mail = await sendInviteEmail(user.email, user.name, inviteUrl);
    res.status(200).json({ inviteUrl, emailSent: mail.sent, emailError: mail.reason });
    return;
  }

  // ── POST /api/admin/clients → create Auth0 user + DB row + emailed invite ──
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

    // Email failures must not lose the invitation: the account exists either
    // way, so report the outcome and still hand back the link to send by hand.
    const mail = await sendInviteEmail(normalizedEmail, created.name, inviteUrl);

    res.status(201).json({
      client: created,
      inviteUrl,
      emailSent: mail.sent,
      emailError: mail.reason,
    });
    return;
  }

  // ── PATCH /api/admin/clients?id=... → activate or deactivate ──
  if (req.method === "PATCH") {
    const id = req.query.id as string;
    if (!id) throw new HttpError(400, "id is required");
    const { active } = readBody<{ active?: boolean }>(req);
    if (typeof active !== "boolean") throw new HttpError(400, "active must be true or false");

    const target = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
    if (!target) throw new HttpError(404, "User not found");

    if (!active) {
      // Two ways to lock yourself out of your own CMS, both worth refusing.
      if (target.id === admin.id) {
        throw new HttpError(400, "You cannot deactivate your own account");
      }
      if (target.role === "admin") {
        const admins = await db.query.users.findMany({ where: eq(schema.users.role, "admin") });
        if (admins.filter((a) => a.active && a.id !== target.id).length === 0) {
          throw new HttpError(400, "That is the last active admin — promote someone else first");
        }
      }
    }

    const [updated] = await db
      .update(schema.users)
      .set({ active })
      .where(eq(schema.users.id, id))
      .returning();
    res.status(200).json(updated);
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

  return methodNotAllowed(res, ["GET", "POST", "PATCH", "DELETE"]);
});
