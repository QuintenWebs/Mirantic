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
 * Message shown to anyone who authenticates successfully at Auth0 but has no
 * invitation here. Deliberately vague about whether the address is known.
 */
const NOT_INVITED =
  "This account has not been invited to Mirantic. Ask your administrator for an invite.";

/**
 * Verify the Auth0 token and resolve the matching DB user.
 *
 * Access is INVITE ONLY: a row must already exist, created by an admin through
 * /api/admin/clients. Authenticating at Auth0 is not by itself enough to get in,
 * so a stray Auth0 signup (or any Google account) lands on a 403 rather than
 * silently becoming a user.
 */
export async function requireUser(req: VercelRequest): Promise<User> {
  const claims = await verifyToken(req);
  const auth0Id = claims.sub;

  // Already linked — the normal path for every returning user.
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.auth0Id, auth0Id),
  });
  if (existing) return existing;

  // Standard claims may live under a namespaced key depending on Auth0 setup;
  // fall back gracefully.
  const email = (
    (claims.email as string) ||
    (claims["https://app.mirantic.com/email"] as string) ||
    ""
  )
    .trim()
    .toLowerCase();
  const name =
    (claims.name as string) ||
    (claims["https://app.mirantic.com/name"] as string) ||
    "";

  if (!email) throw new HttpError(403, NOT_INVITED);

  const invited = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  if (!invited) throw new HttpError(403, NOT_INVITED);

  // The invitation is already bound to a different Auth0 identity. Refusing
  // beats silently re-binding: it would let anyone who can obtain a token for
  // this address take over the existing account.
  if (invited.auth0Id && invited.auth0Id !== auth0Id) {
    throw new HttpError(
      403,
      "This email is already linked to a different sign-in method. Use the one you signed up with."
    );
  }

  // First sign-in against an invitation. Only trust an email the identity
  // provider has actually verified, so an unverified signup cannot claim it.
  if (claims.email_verified !== true) {
    throw new HttpError(403, "Verify your email address, then sign in again.");
  }

  const [linked] = await db
    .update(schema.users)
    .set({ auth0Id, name: name || invited.name })
    .where(eq(schema.users.id, invited.id))
    .returning();
  return linked;
}

export async function requireAdmin(req: VercelRequest): Promise<User> {
  const user = await requireUser(req);
  if (user.role !== "admin") {
    throw new HttpError(403, "Admin access required");
  }
  return user;
}
