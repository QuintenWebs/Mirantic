import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { requireUser, HttpError } from "./_lib/auth.js";
import { withErrors, methodNotAllowed, readBody } from "./_lib/http.js";
import { db, schema } from "./_lib/db.js";

// GET /api/me    → the current user's profile and role.
// PATCH /api/me  → update the parts of it a user may change themselves.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  const user = await requireUser(req);

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

  if (req.method !== "GET") return methodNotAllowed(res, ["GET", "PATCH"]);
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
