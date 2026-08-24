import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser } from "./_lib/auth.js";
import { withErrors, methodNotAllowed } from "./_lib/http.js";

// GET /api/me → the current user's profile and role.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const user = await requireUser(req);
  res.status(200).json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
});
