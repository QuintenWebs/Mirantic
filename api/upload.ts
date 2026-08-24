import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put } from "@vercel/blob";
import { requireUser, HttpError } from "./_lib/auth.js";
import { withErrors, methodNotAllowed } from "./_lib/http.js";
import { requireSiteAccess } from "./_lib/access.js";

export const config = {
  // Read the raw image bytes ourselves rather than letting Vercel parse them.
  api: { bodyParser: false },
};

function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX = 10 * 1024 * 1024; // 10 MB
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX) {
        reject(new HttpError(413, "Image too large (max 10 MB)"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// POST /api/upload?siteId=&filename=  (body: raw image bytes)
// Stores the image in Vercel Blob and returns its public URL. The URL is what
// gets written into content.json — the client site repo is never touched.
export default withErrors(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const user = await requireUser(req);

  const siteId = req.query.siteId as string;
  const filename = (req.query.filename as string) || "upload";
  if (!siteId) throw new HttpError(400, "siteId is required");

  const access = await requireSiteAccess(user, siteId);
  if (!access.canEdit) throw new HttpError(403, "You cannot edit this site");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new HttpError(
      501,
      "Image upload storage is not configured (BLOB_READ_WRITE_TOKEN). Paste an image URL instead, or enable Vercel Blob."
    );
  }

  const body = await readRawBody(req);
  if (!body.length) throw new HttpError(400, "Empty upload");

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `sites/${siteId}/${Date.now()}-${safeName}`;

  const blob = await put(key, body, {
    access: "public",
    contentType: (req.headers["content-type"] as string) || "application/octet-stream",
  });

  res.status(200).json({ url: blob.url });
});
