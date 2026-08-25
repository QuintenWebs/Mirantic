import { Link } from "react-router-dom";
import { ExternalLink, FileText, Pencil } from "lucide-react";
import { useFetch } from "@/lib/useFetch";
import type { Site } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/states";
import { useMe } from "@/lib/me";
import { useViewMode } from "@/lib/view-mode";

export default function SiteSelector() {
  const { me } = useMe();
  const { mode } = useViewMode();
  // In client view an admin sees only their own assignments, not every site.
  const { data: sites, loading, error, refetch } = useFetch<Site[]>(
    (api) => api.get<Site[]>(mode === "client" ? "/api/sites?as=client" : "/api/sites"),
    [mode]
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
            me?.role === "admin" && mode === "admin"
              ? "Add a site from the Sites admin page to get started."
              : me?.role === "admin"
                ? "You aren't assigned to any site as a client. Assign yourself one from Clients to see this view populated."
                : "No sites have been assigned to you yet. Contact your administrator."
          }
        />
      )}

      {!loading && !error && sites && sites.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Card key={site.id} className="flex h-full flex-col">
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
                <p className="truncate text-sm text-muted-foreground">{prettyUrl(site.url)}</p>
              </CardHeader>
              {/* Two destinations, so neither is a guess: the live site in a new
                  tab, or the editor. Previously the whole card went to the
                  editor while the URL inside it looked like an external link. */}
              <CardContent className="mt-auto flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <a href={site.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open site
                  </a>
                </Button>
                <Button size="sm" className="flex-1" asChild>
                  <Link to={`/sites/${site.id}`}>
                    <Pencil className="h-4 w-4" />
                    Edit site
                  </Link>
                </Button>
              </CardContent>
            </Card>
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
