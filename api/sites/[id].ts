import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, eq } from "drizzle-orm";
import { requireUser } from "../_lib/auth";
import { withErrors, methodNotAllowed } from "../_lib/http";
import { requireSiteAccess } from "../_lib/access";
import { fetchContentFile } from "../_lib/github";
import { db, schema } from "../_lib/db";

// GET /api/sites/:id → site metadata + the current user's permissions +
// all unpublished pending changes + (best-effort) the current content.json.
// The content is used to populate the blog tab with existing posts; a failure
// to read it is non-fatal so text/image editing still works.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const user = await requireUser(req);
  const id = req.query.id as string;

  const access = await requireSiteAccess(user, id);

  const changes = await db.query.pendingChanges.findMany({
    where: and(
      eq(schema.pendingChanges.siteId, id),
      eq(schema.pendingChanges.published, false)
    ),
    orderBy: (c, { asc }) => asc(c.createdAt),
  });

  let content: unknown = null;
  let contentError: string | null = null;
  try {
    const fetched = await fetchContentFile(access.site);
    content = fetched.content;
  } catch (err) {
    contentError = err instanceof Error ? err.message : "Could not read content.json";
  }

  res.status(200).json({
    site: access.site,
    canEdit: access.canEdit,
    canPublish: access.canPublish,
    pendingChanges: changes,
    content,
    contentError,
  });
});
