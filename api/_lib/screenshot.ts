/**
 * A picture of a site's home page for the site cards.
 *
 * Captured through Microlink, which needs no account for this volume and hands
 * back a hosted image URL we store. The alternative services either cannot be
 * asked for a fresh capture at all (thum.io keys its cache on the raw URL and
 * discards any parameter meant to bust it) or refuse anonymous use outright
 * (WordPress mShots now returns 403).
 *
 * Never throws: a publish must not fail because a screenshot service is down.
 */
export async function captureScreenshot(siteUrl: string): Promise<string | null> {
  const endpoint =
    "https://api.microlink.io/?url=" +
    encodeURIComponent(siteUrl) +
    // force bypasses their cache, which is what makes this reflect the publish
    // that just happened rather than whatever the page looked like before.
    "&screenshot=true&meta=false&force=true&viewport.width=1280&viewport.height=853";

  try {
    // Bounded so a slow capture cannot hold the publish response open.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      status?: string;
      data?: { screenshot?: { url?: string } };
    };
    return body.status === "success" ? body.data?.screenshot?.url ?? null : null;
  } catch {
    return null;
  }
}
