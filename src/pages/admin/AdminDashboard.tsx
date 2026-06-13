import { Link } from "react-router-dom";
import { Users, Globe, AlertCircle } from "lucide-react";
import { useFetch } from "@/lib/useFetch";
import type { DashboardStats } from "@/lib/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
