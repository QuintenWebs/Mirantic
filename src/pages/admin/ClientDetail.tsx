import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import type { Client, AdminSite } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";

export default function ClientDetail() {
  const { id = "" } = useParams();
  const api = useApi();

  const client = useFetch<Client>((c) => c.get<Client>(`/api/admin/clients?id=${id}`), [id]);
  const sites = useFetch<AdminSite[]>((c) => c.get<AdminSite[]>("/api/admin/sites"), []);

  const assignedMap = new Map(
    (client.data?.sites ?? []).map((s) => [s.id, s])
  );

  async function setAssigned(siteId: string, assigned: boolean) {
    try {
      if (assigned) {
        await api.post("/api/admin/assignments", {
          userId: id,
          siteId,
          canEdit: true,
          canPublish: true,
        });
      } else {
        await api.del(`/api/admin/assignments?userId=${id}&siteId=${siteId}`);
      }
      client.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update assignment");
    }
  }

  async function setPerm(
    siteId: string,
    perm: "canEdit" | "canPublish",
    value: boolean
  ) {
    const current = assignedMap.get(siteId);
    if (!current) return;
    try {
      await api.post("/api/admin/assignments", {
        userId: id,
        siteId,
        canEdit: perm === "canEdit" ? value : current.canEdit,
        canPublish: perm === "canPublish" ? value : current.canPublish,
      });
      client.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update permission");
    }
  }

  return (
    <div>
      <Link
        to="/admin/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Clients
      </Link>

      {client.loading ? (
        <Skeleton className="h-20 w-full" />
      ) : client.error ? (
        <ErrorState message={client.error} onRetry={client.refetch} />
      ) : client.data ? (
        <>
          <div className="mb-6">
            <h1 className="text-xl font-semibold">
              {client.data.name || client.data.email}
            </h1>
            <p className="text-sm text-muted-foreground">{client.data.email}</p>
          </div>

          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Site access
          </h2>

          {sites.loading ? (
            <Skeleton className="h-40 w-full" />
          ) : sites.error ? (
            <ErrorState message={sites.error} onRetry={sites.refetch} />
          ) : (
            <div className="space-y-3">
              {sites.data?.map((site) => {
                const assignment = assignedMap.get(site.id);
                const assigned = Boolean(assignment);
                return (
                  <Card key={site.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{site.name}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {site.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`assign-${site.id}`} className="text-sm">
                          Assigned
                        </Label>
                        <Switch
                          id={`assign-${site.id}`}
                          checked={assigned}
                          onCheckedChange={(v) => setAssigned(site.id, v)}
                        />
                      </div>
                    </div>

                    {assigned && (
                      <div className="mt-3 flex gap-6 border-t pt-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`edit-${site.id}`}
                            checked={assignment!.canEdit}
                            onCheckedChange={(v) => setPerm(site.id, "canEdit", v)}
                          />
                          <Label htmlFor={`edit-${site.id}`} className="text-sm">
                            Can edit
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`publish-${site.id}`}
                            checked={assignment!.canPublish}
                            onCheckedChange={(v) => setPerm(site.id, "canPublish", v)}
                          />
                          <Label htmlFor={`publish-${site.id}`} className="text-sm">
                            Can publish
                          </Label>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
