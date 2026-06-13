import { and, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { HttpError } from "./auth";
import type { Site, User } from "./schema";

export interface SiteAccess {
  site: Site;
  canEdit: boolean;
  canPublish: boolean;
}

/**
 * Resolve a user's access to a site. Admins implicitly have full access to
 * every site. Clients must have an explicit assignment row.
 * Throws 404 if the site doesn't exist, 403 if the user has no access.
 */
export async function requireSiteAccess(
  user: User,
  siteId: string
): Promise<SiteAccess> {
  const site = await db.query.sites.findFirst({
    where: eq(schema.sites.id, siteId),
  });
  if (!site) throw new HttpError(404, "Site not found");

  if (user.role === "admin") {
    return { site, canEdit: true, canPublish: true };
  }

  const assignment = await db.query.userSiteAssignments.findFirst({
    where: and(
      eq(schema.userSiteAssignments.userId, user.id),
      eq(schema.userSiteAssignments.siteId, siteId)
    ),
  });
  if (!assignment) throw new HttpError(403, "No access to this site");

  return {
    site,
    canEdit: assignment.canEdit,
    canPublish: assignment.canPublish,
  };
}
