import { createRemoteJWKSet, jwtVerify } from "jose";
import type { VercelRequest } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db, schema } from "./db.js";
import type { User } from "./schema.js";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

if (!AUTH0_DOMAIN || !AUTH0_AUDIENCE) {
  // Surfaced at cold start so misconfiguration is obvious.
  console.warn("AUTH0_DOMAIN / AUTH0_AUDIENCE not set — auth will fail.");
}

const issuer = `https://${AUTH0_DOMAIN}/`;
const jwks = createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`));

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface Auth0Claims {
  sub: string;
  email?: string;
  name?: string;
  // Custom claims namespace (set by an Auth0 Action) — optional.
  [key: string]: unknown;
}

async function verifyToken(req: VercelRequest): Promise<Auth0Claims> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing bearer token");
  }
  const token = header.slice("Bearer ".length);
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: AUTH0_AUDIENCE,
    });
    return payload as Auth0Claims;
  } catch {
    throw new HttpError(401, "Invalid token");
  }
}

/**
 * Verify the Auth0 token and resolve the matching DB user, creating the row on
 * first sight (just-in-time provisioning). Email/name come from the token's
 * standard OIDC claims (require `openid profile email` scopes on the SPA).
 */
export async function requireUser(req: VercelRequest): Promise<User> {
  const claims = await verifyToken(req);
  const auth0Id = claims.sub;

  // Standard claims may live under a namespaced key depending on Auth0 setup;
  // fall back gracefully.
  const email =
    (claims.email as string) ||
    (claims["https://app.mirantic.com/email"] as string) ||
    "";
  const name =
    (claims.name as string) ||
    (claims["https://app.mirantic.com/name"] as string) ||
    "";

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.auth0Id, auth0Id),
  });
  if (existing) return existing;

  if (!email) {
    throw new HttpError(403, "No email in token; cannot provision user");
  }

  // If a row was pre-created by the admin (invite flow) with this email but no
  // auth0Id yet, link it. Otherwise insert a fresh client user.
  const byEmail = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  if (byEmail && !byEmail.auth0Id) {
    const [linked] = await db
      .update(schema.users)
      .set({ auth0Id, name: name || byEmail.name })
      .where(eq(schema.users.id, byEmail.id))
      .returning();
    return linked;
  }

  const [created] = await db
    .insert(schema.users)
    .values({ auth0Id, email, name, role: "client" })
    .returning();
  return created;
}

export async function requireAdmin(req: VercelRequest): Promise<User> {
  const user = await requireUser(req);
  if (user.role !== "admin") {
    throw new HttpError(403, "Admin access required");
  }
  return user;
}
