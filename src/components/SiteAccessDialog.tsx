import { useState } from "react";
import { Loader2, Ban } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import type { AdminSite, Client } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * Manage who can work on one site. A site can have any number of users; this is
 * the same assignment data as the per-user view, approached from the site side,
 * which is how you think about it when onboarding a client team.
 */
export function SiteAccessDialog({
  site,
  open,
  onOpenChange,
  onChanged,
}: {
  site: AdminSite | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const api = useApi();
  const [busy, setBusy] = useState<string | null>(null);
  const users = useFetch<Client[]>((c) => c.get<Client[]>("/api/admin/clients"), [open]);

  // Assignments live on the user records, so derive this site's from them.
  const assignments = new Map(
    (users.data ?? []).flatMap((u) => {
      const match = u.sites.find((s) => s.id === site?.id);
      return match ? [[u.id, match] as const] : [];
    })
  );

  async function setAssigned(userId: string, assigned: boolean) {
    if (!site) return;
    setBusy(userId);
    try {
      if (assigned) {
        await api.post("/api/admin/assignments", {
          userId,
          siteId: site.id,
          canEdit: true,
          canPublish: true,
        });
      } else {
        await api.del(`/api/admin/assignments?userId=${userId}&siteId=${site.id}`);
      }
      await users.refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update access");
    } finally {
      setBusy(null);
    }
  }

  async function setPerm(userId: string, perm: "canEdit" | "canPublish", value: boolean) {
    if (!site) return;
    const current = assignments.get(userId);
    if (!current) return;
    setBusy(userId);
    try {
      await api.post("/api/admin/assignments", {
        userId,
        siteId: site.id,
        canEdit: perm === "canEdit" ? value : current.canEdit,
        canPublish: perm === "canPublish" ? value : current.canPublish,
      });
      await users.refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update permissions");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Access to {site?.name}</DialogTitle>
          <DialogDescription>
            Anyone switched on here can open this site in the editor.
          </DialogDescription>
        </DialogHeader>

        {users.loading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {users.error && <ErrorState message={users.error} onRetry={users.refetch} />}

        {!users.loading && !users.error && (
          <div className="space-y-2">
            {(users.data ?? []).map((u) => {
              const assignment = assignments.get(u.id);
              const assigned = Boolean(assignment);
              return (
                <div key={u.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{u.name || u.email}</p>
                        {u.role === "admin" && <Badge variant="secondary">Admin</Badge>}
                        {!u.active && (
                          <Badge variant="destructive">
                            <Ban className="mr-1 h-3 w-3" />
                            Deactivated
                          </Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    {busy === u.id ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <Switch
                        checked={assigned}
                        onCheckedChange={(v) => setAssigned(u.id, v)}
                        aria-label={`Give ${u.name || u.email} access`}
                      />
                    )}
                  </div>

                  {assigned && (
                    <div className="mt-3 flex flex-wrap gap-5 border-t pt-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`edit-${u.id}`}
                          checked={assignment!.canEdit}
                          onCheckedChange={(v) => setPerm(u.id, "canEdit", v)}
                        />
                        <Label htmlFor={`edit-${u.id}`} className="text-sm">
                          Can edit
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`publish-${u.id}`}
                          checked={assignment!.canPublish}
                          onCheckedChange={(v) => setPerm(u.id, "canPublish", v)}
                        />
                        <Label htmlFor={`publish-${u.id}`} className="text-sm">
                          Can publish
                        </Label>
                      </div>
                    </div>
                  )}

                  {assigned && u.role === "admin" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Admins can reach every site regardless; this is what they see in client view.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
