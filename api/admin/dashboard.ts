import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../_lib/auth.js";
import { withErrors, methodNotAllowed } from "../_lib/http.js";
import { db, schema } from "../_lib/db.js";
import { sendTestEmail } from "../_lib/email.js";

/**
 * Enough to diagnose a rejected key without revealing it: a real Resend key is
 * "re_" plus about 32 characters. A short one is the masked value copied out of
 * the dashboard; surrounding whitespace comes from a sloppy paste.
 */
function describeKey(key: string | undefined) {
  if (!key) return { present: false };
  return {
    present: true,
    length: key.length,
    startsWithRe: key.startsWith("re_"),
    hasWhitespace: key !== key.trim(),
    looksTruncated: /[.\u2026]$/.test(key.trim()),
    expected: "re_ + ~32 chars (about 35 total)",
  };
}

// GET  /api/admin/dashboard                    → counts + integration status
// POST /api/admin/dashboard?action=test-email  → send the admin a test message
//
// The test lives here rather than under its own route because Vercel's Hobby
// plan caps a deployment at 12 Serverless Functions and every file under api/
// counts as one. See the README.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  const admin = await requireAdmin(req);

  if (req.method === "POST" && req.query.action === "test-email") {
    const result = await sendTestEmail(admin.email);
    // Reported, not thrown: the reason Resend gives back is the whole point of
    // the test, and a 500 would bury it.
    res.status(200).json({
      sent: result.sent,
      reason: result.reason,
      to: admin.email,
      // On failure only, describe the SHAPE of the key — never any part of its
      // value. "Invalid API key" cannot otherwise be told apart from a stale
      // deployment still holding the previous one, because both are present.
      key: result.sent ? undefined : describeKey(process.env.RESEND_API_KEY),
    });
    return;
  }

  if (req.method !== "GET") return methodNotAllowed(res, ["GET", "POST"]);

  const [clientCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.users)
    .where(eq(schema.users.role, "client"));

  const [siteCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.sites);

  const sitesWithPending = await db
    .selectDistinct({ siteId: schema.pendingChanges.siteId })
    .from(schema.pendingChanges)
    .where(eq(schema.pendingChanges.published, false));

  res.status(200).json({
    clients: clientCount?.n ?? 0,
    sites: siteCount?.n ?? 0,
    sitesWithPendingChanges: sitesWithPending.length,
    // Whether each integration is configured — never the values themselves.
    integrations: {
      email: Boolean(process.env.RESEND_API_KEY),
      emailFrom: process.env.INVITE_FROM || "Mirantic <invites@mirantic.com>",
      github: Boolean(process.env.GITHUB_TOKEN),
      imageUploads: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    },
  });
});
