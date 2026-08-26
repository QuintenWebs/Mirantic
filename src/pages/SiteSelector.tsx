import { Link } from "react-router-dom";
import { ExternalLink, FileText, Pencil, Image as ImageIcon } from "lucide-react";
import { useFetch } from "@/lib/useFetch";
import type { Site } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/states";
import { useViewMode } from "@/lib/view-mode";

export default function SiteSelector() {
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
        <p className="text-sm text-muted-foreground">Select a site to edit its content.</p>
      </div>

      {loading && (
        <div className="grid gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {!loading && error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && sites && sites.length === 0 && (
        <EmptyState
          title="No sites yet"
          description="You have not been given access to a site. Ask your administrator."
        />
      )}

      {!loading && !error && sites && sites.length > 0 && (
        <div className="grid gap-4">
          {sites.map((site) => (
            /* Most clients have exactly one site, so the card is wide and leads
               with a picture of the thing being edited rather than its name. */
            <Card key={site.id} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                <div className="w-full shrink-0 border-b bg-muted sm:w-[320px] sm:border-b-0 sm:border-r">
                  {site.screenshotUrl ? (
                    <img
                      src={site.screenshotUrl}
                      alt={`${site.name} home page`}
                      loading="lazy"
                      className="h-40 w-full object-cover object-top sm:h-full"
                    />
                  ) : (
                    /* Rather than an empty grey box, say why there is no picture
                       — it appears by itself after the first publish. */
                    <div className="flex h-40 w-full flex-col items-center justify-center gap-1.5 px-4 text-center sm:h-full">
                      <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
                      <p className="text-xs text-muted-foreground">
                        A preview appears here after you publish
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="truncate text-lg font-semibold">{site.name}</h2>
                      {site.hasBlog && (
                        <Badge variant="secondary" className="shrink-0">
                          <FileText className="mr-1 h-3 w-3" />
                          Blog
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{prettyUrl(site.url)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {site.lastPublishedAt
                        ? `Last published ${new Date(site.lastPublishedAt).toLocaleDateString()}`
                        : "Not published yet"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={site.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Open site
                      </a>
                    </Button>
                    <Button size="sm" asChild>
                      <Link to={`/sites/${site.id}`}>
                        <Pencil className="h-4 w-4" />
                        Edit site
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
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
