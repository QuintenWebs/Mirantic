import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Loader2, Pencil, ExternalLink, FileText, Users } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import type { AdminSite } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { SiteAccessDialog } from "@/components/SiteAccessDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/states";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SiteForm {
  name: string;
  url: string;
  githubRepo: string;
  githubBranch: string;
  contentPath: string;
  deployHookUrl: string;
  hasBlog: boolean;
}

const EMPTY_FORM: SiteForm = {
  name: "",
  url: "",
  githubRepo: "",
  githubBranch: "main",
  contentPath: "src/content.json",
  deployHookUrl: "",
  hasBlog: false,
};

export default function AdminSites() {
  const api = useApi();
  const { data, loading, error, refetch } = useFetch<AdminSite[]>(
    (c) => c.get<AdminSite[]>("/api/admin/sites"),
    []
  );

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SiteForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [accessSite, setAccessSite] = useState<AdminSite | null>(null);

  function openCreate() {
    setTouched({});
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(site: AdminSite) {
    setTouched({});
    setEditingId(site.id);
    setForm({
      name: site.name,
      url: site.url,
      githubRepo: site.githubRepo,
      githubBranch: site.githubBranch,
      contentPath: site.contentPath,
      deployHookUrl: site.deployHookUrl ?? "",
      hasBlog: site.hasBlog,
    });
    setOpen(true);
  }

  const set = <K extends keyof SiteForm>(key: K, value: SiteForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit() {
    if (!valid) {
      setTouched({ name: true, url: true, githubRepo: true, contentPath: true });
      return;
    }
    // Persist the cleaned-up values so the stored repo is always owner/repo.
    const payload = { ...form, githubRepo: repo ?? form.githubRepo, url: url ?? form.url };
    setSubmitting(true);
    try {
      if (editingId) {
        await api.patch(`/api/admin/sites?id=${editingId}`, payload);
        toast.success("Site updated");
      } else {
        await api.post("/api/admin/sites", payload);
        toast.success("Site created");
      }
      setOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save site");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(site: AdminSite) {
    if (!confirm(`Delete ${site.name}? This removes its CMS record (not the repo).`)) return;
    setDeletingId(site.id);
    try {
      await api.del(`/api/admin/sites?id=${site.id}`);
      toast.success("Site deleted");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete site");
    } finally {
      setDeletingId(null);
    }
  }

  // Accept what people actually paste — a repo URL, a bare domain — and say what
  // is wrong when it can't be understood, rather than just disabling the button.
  const repo = normalizeRepo(form.githubRepo);
  const url = normalizeUrl(form.url);
  const problems: Record<string, string> = {};
  if (!form.name.trim()) problems.name = "Give the site a name.";
  if (!form.url.trim()) problems.url = "The live site URL is required.";
  else if (!url) problems.url = "That doesn't look like a web address.";
  if (!form.githubRepo.trim()) problems.githubRepo = "The repo holding the content file is required.";
  else if (!repo)
    problems.githubRepo =
      "Use owner/repo, or paste the repository's GitHub URL and it'll be converted.";
  if (!form.contentPath.trim()) problems.contentPath = "Where the content file lives in the repo.";
  const valid = Object.keys(problems).length === 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sites</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add site
        </Button>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && data && data.length === 0 && (
        <EmptyState
          title="No sites yet"
          description="Add a client site to start managing its content."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add site
            </Button>
          }
        />
      )}

      {!loading && !error && data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((site) => (
            <Card key={site.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{site.name}</p>
                    {site.hasBlog && (
                      <Badge variant="secondary">
                        <FileText className="mr-1 h-3 w-3" /> Blog
                      </Badge>
                    )}
                  </div>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    {site.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {site.githubRepo} · {site.githubBranch} · {site.contentPath}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      {lastPublished(site.lastPublishedAt)}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    {site.clients.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No users assigned</span>
                    ) : (
                      site.clients.map((c) => (
                        <Badge key={c.id} variant="outline">
                          {c.name || c.email}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setAccessSite(site)}>
                    <Users className="h-4 w-4" /> Users
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/sites/${site.id}`}>Open editor</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(site)}
                    title="Edit settings"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={deletingId === site.id}
                    onClick={() => handleDelete(site)}
                    title="Delete site"
                  >
                    {deletingId === site.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SiteAccessDialog
        site={accessSite}
        open={Boolean(accessSite)}
        onOpenChange={(o) => !o && setAccessSite(null)}
        onChanged={refetch}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit site" : "Add site"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <FormRow label="Name" error={touched.name ? problems.name : undefined}>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                onBlur={() => touch("name")}
              />
            </FormRow>
            <FormRow
              label="URL"
              hint="The live site URL loaded in the editor"
              error={touched.url ? problems.url : undefined}
              note={url && url !== form.url.trim() ? `Will be saved as ${url}` : undefined}
            >
              <Input
                value={form.url}
                onChange={(e) => set("url", e.target.value)}
                onBlur={() => touch("url")}
                placeholder="https://clientsite.com"
              />
            </FormRow>
            <FormRow
              label="GitHub repo"
              hint="owner/repo"
              error={touched.githubRepo ? problems.githubRepo : undefined}
              note={repo && repo !== form.githubRepo.trim() ? `Will be saved as ${repo}` : undefined}
            >
              <Input
                value={form.githubRepo}
                onChange={(e) => set("githubRepo", e.target.value)}
                onBlur={() => touch("githubRepo")}
                placeholder="mirantic/client-site"
              />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Branch">
                <Input
                  value={form.githubBranch}
                  onChange={(e) => set("githubBranch", e.target.value)}
                />
              </FormRow>
              <FormRow label="Content path" error={touched.contentPath ? problems.contentPath : undefined}>
                <Input
                  value={form.contentPath}
                  onChange={(e) => set("contentPath", e.target.value)}
                  onBlur={() => touch("contentPath")}
                />
              </FormRow>
            </div>
            <FormRow label="Vercel deploy hook URL" hint="Optional">
              <Input
                value={form.deployHookUrl}
                onChange={(e) => set("deployHookUrl", e.target.value)}
                placeholder="https://api.vercel.com/v1/integrations/deploy/…"
              />
            </FormRow>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="has-blog"
                checked={form.hasBlog}
                onCheckedChange={(v) => set("hasBlog", v)}
              />
              <Label htmlFor="has-blog">This site has a blog</Label>
            </div>
          </div>

          <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {!valid && (
              <p className="mr-auto text-sm text-muted-foreground">
                {problems.name ?? problems.url ?? problems.githubRepo ?? problems.contentPath}
              </p>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!valid || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Save changes" : "Create site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormRow({
  label,
  hint,
  error,
  note,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        note && <p className="text-xs text-muted-foreground">{note}</p>
      )}
    </div>
  );
}

function lastPublished(at: string | null): string {
  if (!at) return "Never published";
  const d = new Date(at);
  return `Last published ${d.toLocaleDateString()}`;
}

/**
 * Accept either `owner/repo` or a repository URL — people paste the address bar
 * far more often than they type the short form. Returns null if it is neither.
 */
function normalizeRepo(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  // Tolerates a trailing path, so a URL copied while browsing a branch
  // (…/owner/repo/tree/main) still resolves to owner/repo.
  const fromUrl = raw.match(/github\.com[/:]([^/\s]+)\/([^/\s?#]+?)(?:\.git)?(?:[/?#].*)?$/i);
  const [owner, repo] = fromUrl
    ? [fromUrl[1], fromUrl[2]]
    : raw.replace(/\.git$/, "").replace(/\/$/, "").split("/");
  if (!owner || !repo || owner.includes("/") || repo.includes("/")) return null;
  if (/\s/.test(owner) || /\s/.test(repo)) return null;
  return `${owner}/${repo}`;
}

/** Accept a bare domain and assume https, which is what people type. */
function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname.includes(".")) return null;
    return parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, ""));
  } catch {
    return null;
  }
}
