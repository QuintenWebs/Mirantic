import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireUser, HttpError } from "../_lib/auth.js";
import { withErrors, methodNotAllowed } from "../_lib/http.js";
import { createInviteTicket } from "../_lib/auth0-management.js";
import { sendPasswordResetEmail } from "../_lib/email.js";

// POST /api/account/password → email the signed-in user a link to set a new one.
//
// The app never sees a password: Auth0 issues a change ticket and the user sets
// it on Auth0's own page. Nothing here accepts a current or new password, so
// there is no credential to mishandle or log.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const user = await requireUser(req);

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
});
