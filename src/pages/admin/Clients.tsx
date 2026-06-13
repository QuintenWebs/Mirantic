import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Loader2, Copy, Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import type { Client } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/states";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Clients() {
  const api = useApi();
  const { data, loading, error, refetch } = useFetch<Client[]>(
    (client) => client.get<Client[]>("/api/admin/clients"),
    []
  );

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd() {
    setSubmitting(true);
    try {
      const res = await api.post<{ inviteUrl: string }>("/api/admin/clients", {
        name,
        email,
      });
      setInviteUrl(res.inviteUrl);
      setName("");
      setEmail("");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create client");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(client: Client) {
    if (!confirm(`Remove ${client.name || client.email}? This deletes their login.`)) return;
    setDeletingId(client.id);
    try {
      await api.del(`/api/admin/clients?id=${client.id}`);
      toast.success("Client removed");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove client");
    } finally {
      setDeletingId(null);
    }
  }

  function closeAdd() {
    setAddOpen(false);
    setInviteUrl(null);
    setName("");
    setEmail("");
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clients</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add client
        </Button>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && data && data.length === 0 && (
        <EmptyState
          title="No clients yet"
          description="Add a client to create their login and assign them sites."
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add client
            </Button>
          }
        />
      )}

      {!loading && !error && data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((client) => (
            <Card key={client.id} className="flex items-center justify-between p-4">
              <Link to={`/admin/clients/${client.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium">{client.name || client.email}</p>
                <p className="truncate text-sm text-muted-foreground">{client.email}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {client.sites.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No sites assigned</span>
                  ) : (
                    client.sites.map((s) => (
                      <Badge key={s.id} variant="secondary">
                        {s.name}
                      </Badge>
                    ))
                  )}
                </div>
              </Link>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={deletingId === client.id}
                  onClick={() => handleDelete(client)}
                  title="Remove client"
                >
                  {deletingId === client.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <Link to={`/admin/clients/${client.id}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(o) => (o ? setAddOpen(true) : closeAdd())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add client</DialogTitle>
            <DialogDescription>
              Creates an Auth0 login. Share the invite link so they can set a password.
            </DialogDescription>
          </DialogHeader>

          {inviteUrl ? (
            <div className="space-y-3">
              <p className="text-sm">Client created. Send them this invite link:</p>
              <div className="flex items-center gap-2">
                <Input readOnly value={inviteUrl} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Name</Label>
                <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {inviteUrl ? (
              <Button onClick={closeAdd}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={closeAdd}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={!email.trim() || submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create client
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
