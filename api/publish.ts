import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq, inArray } from "drizzle-orm";
import { requireUser, HttpError } from "./_lib/auth";
import { withErrors, methodNotAllowed, readBody } from "./_lib/http";
import { requireSiteAccess } from "./_lib/access";
import { db, schema } from "./_lib/db";
import { fetchContentFile, commitContentFile, triggerDeployHook } from "./_lib/github";
import { applyChanges } from "./_lib/content";

// POST /api/publish { siteId } → commit all pending changes to content.json,
// trigger redeploy, and mark the changes published.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const user = await requireUser(req);
  const { siteId } = readBody<{ siteId: string }>(req);
  if (!siteId) throw new HttpError(400, "siteId is required");

  const access = await requireSiteAccess(user, siteId);
  if (!access.canPublish) throw new HttpError(403, "You cannot publish this site");
  const site = access.site;

  const changes = await db.query.pendingChanges.findMany({
    where: and(
      eq(schema.pendingChanges.siteId, siteId),
      eq(schema.pendingChanges.published, false)
    ),
    orderBy: (c, { asc }) => asc(c.createdAt),
  });
  if (changes.length === 0) throw new HttpError(400, "Nothing to publish");

  // 1. Fetch the current content.json from GitHub.
  const { content, sha } = await fetchContentFile(site);

  // 2. Apply every pending change in order.
  const updated = applyChanges(
    content,
    changes.map((c) => ({
      field: c.field,
      changeType: c.changeType,
      newValue: c.newValue,
    }))
  );

  // 3. Commit it back.
  const message = `CMS: publish ${changes.length} change${
    changes.length === 1 ? "" : "s"
  } [${site.name}]`;
  const { commitSha } = await commitContentFile(site, updated, sha, message);

  // 4. Trigger the Vercel deploy hook (fallback / explicit trigger).
  await triggerDeployHook(site);

  // 5. Mark changes published and stamp the site.
  const publishedAt = new Date();
  await db
    .update(schema.pendingChanges)
    .set({ published: true, publishedAt })
    .where(
      inArray(
        schema.pendingChanges.id,
        changes.map((c) => c.id)
      )
    );
  await db
    .update(schema.sites)
    .set({ lastPublishedAt: publishedAt })
    .where(eq(schema.sites.id, siteId));

  res.status(200).json({
    published: changes.length,
    commitSha,
    deployTriggered: Boolean(site.deployHookUrl),
  });
});
