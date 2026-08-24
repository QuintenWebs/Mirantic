import { Octokit } from "octokit";
import { HttpError } from "./auth.js";
import type { Site } from "./schema.js";

const token = process.env.GITHUB_TOKEN;

function octokit(): Octokit {
  if (!token) throw new HttpError(500, "GITHUB_TOKEN is not configured");
  return new Octokit({ auth: token });
}

function splitRepo(repo: string): { owner: string; repo: string } {
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new HttpError(400, `Invalid github_repo "${repo}" — expected "owner/repo"`);
  }
  return { owner, repo: name };
}

export interface FetchedContent {
  content: unknown;
  /** Blob SHA of the existing file — required to update it. */
  sha: string | null;
}

/** Fetch and parse the current content.json from the site's repo. */
export async function fetchContentFile(site: Site): Promise<FetchedContent> {
  const gh = octokit();
  const { owner, repo } = splitRepo(site.githubRepo);
  try {
    const res = await gh.rest.repos.getContent({
      owner,
      repo,
      path: site.contentPath,
      ref: site.githubBranch,
    });
    const data = res.data;
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      throw new HttpError(400, `${site.contentPath} is not a file`);
    }
    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    let parsed: unknown = {};
    if (decoded.trim()) {
      try {
        parsed = JSON.parse(decoded);
      } catch {
        throw new HttpError(400, `${site.contentPath} is not valid JSON`);
      }
    }
    return { content: parsed, sha: data.sha };
  } catch (err: unknown) {
    if (isNotFound(err)) {
      // File doesn't exist yet — treat as empty, will be created on commit.
      return { content: {}, sha: null };
    }
    if (err instanceof HttpError) throw err;
    throw new HttpError(502, `GitHub read failed: ${describe(err)}`);
  }
}

/** Commit the updated content.json back to the repo. */
export async function commitContentFile(
  site: Site,
  content: unknown,
  sha: string | null,
  message: string
): Promise<{ commitSha: string }> {
  const gh = octokit();
  const { owner, repo } = splitRepo(site.githubRepo);
  const body = Buffer.from(JSON.stringify(content, null, 2) + "\n", "utf-8").toString(
    "base64"
  );
  try {
    const res = await gh.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: site.contentPath,
      branch: site.githubBranch,
      message,
      content: body,
      ...(sha ? { sha } : {}),
    });
    return { commitSha: res.data.commit.sha ?? "" };
  } catch (err: unknown) {
    throw new HttpError(502, `GitHub commit failed: ${describe(err)}`);
  }
}

/** Trigger the site's Vercel deploy hook, if configured. */
export async function triggerDeployHook(site: Site): Promise<void> {
  if (!site.deployHookUrl) return;
  try {
    const res = await fetch(site.deployHookUrl, { method: "POST" });
    if (!res.ok) {
      throw new Error(`status ${res.status}`);
    }
  } catch (err: unknown) {
    throw new HttpError(502, `Deploy hook failed: ${describe(err)}`);
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { status?: number }).status === 404;
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
