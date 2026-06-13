import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "client"]);
export const changeTypeEnum = pgEnum("change_type", ["field", "blog_post_add"]);

// ── Users ──────────────────────────────────────────────────────
// One row per Auth0 account. The single admin is set manually
// (UPDATE users SET role = 'admin' WHERE email = '...').
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  auth0Id: text("auth0_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  role: roleEnum("role").notNull().default("client"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Sites ──────────────────────────────────────────────────────
export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  // GitHub repo in "owner/repo" form.
  githubRepo: text("github_repo").notNull(),
  githubBranch: text("github_branch").notNull().default("main"),
  // Path to the content file within the repo, e.g. "src/content.json".
  contentPath: text("content_path").notNull().default("src/content.json"),
  deployHookUrl: text("deploy_hook_url"),
  hasBlog: boolean("has_blog").notNull().default(false),
  lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── User ↔ Site assignments ────────────────────────────────────
export const userSiteAssignments = pgTable(
  "user_site_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    canEdit: boolean("can_edit").notNull().default(true),
    canPublish: boolean("can_publish").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userSiteUnique: unique("user_site_unique").on(t.userId, t.siteId),
    siteIdx: index("assignment_site_idx").on(t.siteId),
  })
);

// ── Pending changes ────────────────────────────────────────────
// A pending change is an unpublished edit to a site's content.json.
//  - change_type "field": one field path (e.g. "hero.title"). oldValue/newValue
//    hold the previous and new value (string for text, URL string for images).
//  - change_type "blog_post_add": a brand-new blog post. field is "blog.posts[+]",
//    oldValue is null, newValue is the full post object.
export const pendingChanges = pgTable(
  "pending_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    changeType: changeTypeEnum("change_type").notNull().default("field"),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    published: boolean("published").notNull().default(false),
    createdById: uuid("created_by")
      .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => ({
    sitePublishedIdx: index("change_site_published_idx").on(t.siteId, t.published),
  })
);

export type User = typeof users.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type UserSiteAssignment = typeof userSiteAssignments.$inferSelect;
export type PendingChange = typeof pendingChanges.$inferSelect;
