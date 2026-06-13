import { HttpError } from "./auth";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const M2M_CLIENT_ID = process.env.AUTH0_M2M_CLIENT_ID;
const M2M_CLIENT_SECRET = process.env.AUTH0_M2M_CLIENT_SECRET;
const APP_URL = process.env.APP_URL || "https://app.mirantic.com";

const mgmtAudience = `https://${AUTH0_DOMAIN}/api/v2/`;

async function getMgmtToken(): Promise<string> {
  if (!AUTH0_DOMAIN || !M2M_CLIENT_ID || !M2M_CLIENT_SECRET) {
    throw new HttpError(500, "Auth0 Management API is not configured");
  }
  const res = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: M2M_CLIENT_ID,
      client_secret: M2M_CLIENT_SECRET,
      audience: mgmtAudience,
    }),
  });
  if (!res.ok) {
    throw new HttpError(502, `Auth0 token request failed (${res.status})`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export interface CreatedAuth0User {
  auth0Id: string;
  email: string;
  name: string;
}

/**
 * Create a client user in Auth0 (database connection) and return a password
 * reset / change ticket that serves as the invite link. The user follows the
 * link to set their password and then logs in.
 */
export async function createClientUser(
  email: string,
  name: string
): Promise<{ user: CreatedAuth0User; inviteUrl: string }> {
  const mgmtToken = await getMgmtToken();
  const headers = {
    authorization: `Bearer ${mgmtToken}`,
    "content-type": "application/json",
  };

  // A throwaway strong password — the user resets it via the invite ticket.
  const tempPassword = `Tmp-${cryptoRandom()}-Aa1!`;

  const createRes = await fetch(`https://${AUTH0_DOMAIN}/api/v2/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      name: name || email,
      password: tempPassword,
      connection: "Username-Password-Authentication",
      email_verified: false,
      verify_email: false,
    }),
  });

  if (!createRes.ok) {
    const detail = await safeJson(createRes);
    if (createRes.status === 409) {
      throw new HttpError(409, "A user with this email already exists in Auth0");
    }
    throw new HttpError(502, `Auth0 user creation failed: ${detail}`);
  }

  const created = (await createRes.json()) as {
    user_id: string;
    email: string;
    name: string;
  };

  // Create a password-change ticket (the invite link).
  const ticketRes = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/tickets/password-change`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: created.user_id,
        result_url: `${APP_URL}/login`,
        mark_email_as_verified: true,
      }),
    }
  );
  if (!ticketRes.ok) {
    const detail = await safeJson(ticketRes);
    throw new HttpError(502, `Auth0 invite ticket failed: ${detail}`);
  }
  const ticket = (await ticketRes.json()) as { ticket: string };

  return {
    user: {
      auth0Id: created.user_id,
      email: created.email,
      name: created.name,
    },
    inviteUrl: ticket.ticket,
  };
}

export async function deleteAuth0User(auth0Id: string): Promise<void> {
  if (!auth0Id) return;
  const mgmtToken = await getMgmtToken();
  const res = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(auth0Id)}`,
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${mgmtToken}` },
    }
  );
  // 204 on success; tolerate 404 (already gone).
  if (!res.ok && res.status !== 404) {
    throw new HttpError(502, `Auth0 user deletion failed (${res.status})`);
  }
}

function cryptoRandom(): string {
  // Node 20+ has global crypto.
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

async function safeJson(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return JSON.stringify(j);
  } catch {
    return `status ${res.status}`;
  }
}
