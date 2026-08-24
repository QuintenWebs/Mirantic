import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { requireUser } from "./_lib/auth.js";
import { withErrors, methodNotAllowed } from "./_lib/http.js";
import { db, schema } from "./_lib/db.js";

// GET /api/me → the current user's profile and role.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const user = await requireUser(req);

  // How many sites this account is assigned to as a client. An admin uses it to
  // tell whether "view as client" would show anything at all.
  const assignments = await db
    .select({ id: schema.userSiteAssignments.id })
    .from(schema.userSiteAssignments)
    .where(eq(schema.userSiteAssignments.userId, user.id));

  res.status(200).json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    assignedSites: assignments.length,
  });
});
