import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { requireUser, HttpError } from "./_lib/auth.js";
import { withErrors, methodNotAllowed, readBody } from "./_lib/http.js";
import { db, schema } from "./_lib/db.js";
import { createInviteTicket } from "./_lib/auth0-management.js";
import { sendPasswordResetEmail } from "./_lib/email.js";

// Everything the signed-in user can do to their own account:
//   GET   /api/me                   → profile and role
//   PATCH /api/me                   → update what they may change themselves
//   POST  /api/me?action=password   → email a link to set a new password
//
// The password action lives here rather than under its own route because Vercel's
// Hobby plan caps a deployment at 12 Serverless Functions, and each file is one.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  const user = await requireUser(req);

  if (req.method === "POST" && req.query.action === "password") {
    // The app never sees a password: Auth0 issues a change ticket and the user
    // sets it on Auth0's own page, so there is no credential to mishandle here.
    if (!user.auth0Id?.startsWith("auth0|")) {
      throw new HttpError(
        400,
        "This account signs in with Google, so it has no Mirantic password to change."
      );
    }
    const url = await createInviteTicket(user.auth0Id);
    const mail = await sendPasswordResetEmail(user.email, user.name, url);
    if (!mail.sent) {
      throw new HttpError(502, `Could not send the email: ${mail.reason ?? "unknown error"}`);
    }
    res.status(200).json({ sent: true, email: user.email });
    return;
  }

  if (req.method === "PATCH") {
    const { name } = readBody<{ name?: string }>(req);
    const trimmed = (name ?? "").trim();
    if (!trimmed) throw new HttpError(400, "Name cannot be empty");
    if (trimmed.length > 120) throw new HttpError(400, "Name is too long");

    // Only the name: role and email are not self-service. Changing your own
    // role would be privilege escalation, and email is the identity the
    // invitation was issued against.
    const [updated] = await db
      .update(schema.users)
      .set({ name: trimmed })
      .where(eq(schema.users.id, user.id))
      .returning();
    res.status(200).json(await withCounts(updated));
    return;
  }

  if (req.method !== "GET") return methodNotAllowed(res, ["GET", "PATCH", "POST"]);
  res.status(200).json(await withCounts(user));
});

async function withCounts(user: typeof schema.users.$inferSelect) {
  // How many sites this account is assigned to as a client. An admin uses it to
  // tell whether "view as client" would show anything at all.
  const assignments = await db
    .select({ id: schema.userSiteAssignments.id })
    .from(schema.userSiteAssignments)
    .where(eq(schema.userSiteAssignments.userId, user.id));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    assignedSites: assignments.length,
    // Social identities have no password to change in Auth0.
    hasPassword: (user.auth0Id ?? "").startsWith("auth0|"),
  };
}
