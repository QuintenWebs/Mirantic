import { useState } from "react";
import { Link } from "react-router-dom";
import { Users, Globe, AlertCircle, Mail, Github, Image, Check, X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";
import type { DashboardStats } from "@/lib/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";

export default function AdminDashboard() {
  const { data, loading, error, refetch } = useFetch<DashboardStats>(
    (api) => api.get<DashboardStats>("/api/admin/dashboard"),
    []
  );

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Dashboard</h1>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-12" />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            to="/admin/clients"
            icon={<Users className="h-4 w-4" />}
            label="Clients"
            value={data.clients}
          />
          <StatCard
            to="/admin/sites"
            icon={<Globe className="h-4 w-4" />}
            label="Sites"
            value={data.sites}
          />
          <StatCard
            to="/admin/sites"
            icon={<AlertCircle className="h-4 w-4" />}
            label="Sites with unpublished changes"
            value={data.sitesWithPendingChanges}
            highlight={data.sitesWithPendingChanges > 0}
          />
        </div>
      )}

      {!loading && !error && data && <Integrations data={data} />}
    </div>
  );
}

/**
 * What the app can and cannot currently do, and a way to prove the email path
 * works without inviting a real person to find out.
 */
function Integrations({ data }: { data: DashboardStats }) {
  const api = useApi();
  const [sending, setSending] = useState(false);
  const { email, emailFrom, github, imageUploads } = data.integrations;

  async function sendTest() {
    setSending(true);
    try {
      const r = await api.post<{ sent: boolean; reason?: string; to: string }>(
        "/api/admin/dashboard?action=test-email"
      );
      if (r.sent) toast.success(`Test email sent to ${r.to}`);
      else toast.error(r.reason ?? "The email could not be sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The email could not be sent");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 text-base font-semibold">Integrations</h2>
      <Card className="divide-y">
        <IntegrationRow
          icon={<Mail className="h-4 w-4" />}
          label="Sending email"
          ok={email}
          okNote={`Invitations are sent from ${emailFrom}.`}
          failNote="RESEND_API_KEY isn't set, so invitations have to be copied and sent by hand."
          action={
            email && (
              <Button variant="outline" size="sm" onClick={sendTest} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send test
              </Button>
            )
          }
        />
        <IntegrationRow
          icon={<Github className="h-4 w-4" />}
          label="Publishing to GitHub"
          ok={github}
          okNote="Content can be read and published."
          failNote="GITHUB_TOKEN isn't set, so nothing can be read or published."
        />
        <IntegrationRow
          icon={<Image className="h-4 w-4" />}
          label="Image uploads"
          ok={imageUploads}
          okNote="Clients can upload image files."
          failNote="BLOB_READ_WRITE_TOKEN isn't set — image fields fall back to pasting a URL."
        />
      </Card>
    </div>
  );
}

function IntegrationRow({
  icon,
  label,
  ok,
  okNote,
  failNote,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
  okNote: string;
  failNote: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 p-4">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{label}</p>
          <span
            className={
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium " +
              (ok ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
            }
          >
            {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {ok ? "Configured" : "Not set up"}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{ok ? okNote : failNote}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({
  to,
  icon,
  label,
  value,
  highlight,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Link to={to}>
      <Card className="transition-colors hover:border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {icon}
            {label}
          </CardTitle>
          <p
            className={
              "text-3xl font-semibold " + (highlight ? "text-primary" : "")
            }
          >
            {value}
          </p>
        </CardHeader>
      </Card>
    </Link>
  );
}
