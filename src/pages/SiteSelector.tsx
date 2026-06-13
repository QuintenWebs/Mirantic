import { Link } from "react-router-dom";
import { ExternalLink, FileText } from "lucide-react";
import { useFetch } from "@/lib/useFetch";
import type { Site } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/states";
import { useMe } from "@/lib/me";

export default function SiteSelector() {
  const { me } = useMe();
  const { data: sites, loading, error, refetch } = useFetch<Site[]>(
    (api) => api.get<Site[]>("/api/sites"),
    []
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Your sites</h1>
        <p className="text-sm text-muted-foreground">
          Select a site to edit its content.
        </p>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && sites && sites.length === 0 && (
        <EmptyState
          title="No sites yet"
          description={
            me?.role === "admin"
              ? "Add a site from the Sites admin page to get started."
              : "No sites have been assigned to you yet. Contact your administrator."
          }
        />
      )}

      {!loading && !error && sites && sites.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Link key={site.id} to={`/sites/${site.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{site.name}</CardTitle>
                    {site.hasBlog && (
                      <Badge variant="secondary" className="shrink-0">
                        <FileText className="mr-1 h-3 w-3" />
                        Blog
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    {prettyUrl(site.url)}
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function prettyUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
