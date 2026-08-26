export type Role = "admin" | "client";

export interface Me {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Sites this account is assigned to as a client. */
  assignedSites: number;
  /** False for social logins, which have no Mirantic password. */
  hasPassword: boolean;
}

export interface InviteResult {
  client: Client;
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string;
}

export interface Site {
  id: string;
  name: string;
  url: string;
  githubRepo: string;
  githubBranch: string;
  contentPath: string;
  deployHookUrl: string | null;
  hasBlog: boolean;
  /** Home-page screenshot, refreshed on publish. Null until first published. */
  screenshotUrl: string | null;
  lastPublishedAt: string | null;
  createdAt: string;
  // Present on list endpoints.
  canEdit?: boolean;
  canPublish?: boolean;
}

export type ChangeType = "field" | "blog_post_add";

export interface PendingChange {
  id: string;
  siteId: string;
  field: string;
  changeType: ChangeType;
  oldValue: unknown;
  newValue: unknown;
  published: boolean;
  createdById: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface SiteWithChanges {
  site: Site;
  canEdit: boolean;
  canPublish: boolean;
  pendingChanges: PendingChange[];
  content: unknown;
  contentError: string | null;
}

export interface ClientSiteRef {
  id: string;
  name: string;
  canEdit: boolean;
  canPublish: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  /** Deactivated users keep their data but cannot sign in. */
  active: boolean;
  sites: ClientSiteRef[];
}

export interface SiteClientRef {
  id: string;
  name: string;
  email: string;
}

export interface AdminSite extends Site {
  clients: SiteClientRef[];
}

export interface DashboardStats {
  clients: number;
  sites: number;
  sitesWithPendingChanges: number;
  integrations: {
    email: boolean;
    emailFrom: string;
    github: boolean;
    imageUploads: boolean;
  };
}

// Blog post shape stored in content.json under blog.posts[].
export interface BlogPost {
  title: string;
  slug: string;
  date: string;
  author: string;
  cover: string;
  body: string;
}
