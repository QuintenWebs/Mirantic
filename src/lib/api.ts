import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useMemo } from "react";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type TokenGetter = () => Promise<string>;

async function request<T>(
  getToken: TokenGetter,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getToken();
  const res = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

async function uploadFile<T>(
  getToken: TokenGetter,
  path: string,
  file: File
): Promise<T> {
  const token = await getToken();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
  upload<T>(path: string, file: File): Promise<T>;
}

/**
 * Errors that mean "this session can no longer produce a token" rather than
 * "something went wrong". They are unrecoverable in place — the only way out is
 * to authenticate again — so the app re-authenticates instead of showing an
 * error the user cannot act on.
 *
 * missing_refresh_token is the one that bites: the SDK asks for offline_access,
 * and if the Auth0 API does not allow it no refresh token is ever stored, so
 * every silent call fails for a user who is otherwise perfectly logged in.
 */
const REAUTH_FLAG = "mirantic:reauth-attempted";

const UNRECOVERABLE = [
  "missing_refresh_token",
  "invalid_grant",
  "login_required",
  "consent_required",
  "interaction_required",
];

function isUnrecoverable(err: unknown): boolean {
  const code = (err as { error?: string })?.error;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    (typeof code === "string" && UNRECOVERABLE.includes(code)) ||
    /missing refresh token/i.test(message)
  );
}

export function useApi(): ApiClient {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();

  const getToken = useCallback<TokenGetter>(async () => {
    try {
      const token = await getAccessTokenSilently();
      sessionStorage.removeItem(REAUTH_FLAG);
      return token;
    } catch (err) {
      if (isUnrecoverable(err)) {
        // Re-authenticate at most once per tab. If a fresh login still cannot
        // produce a token — which is what happens while the Auth0 API has
        // Allow Offline Access switched off — a second redirect would bounce
        // the user round a loop instead of telling them anything.
        if (sessionStorage.getItem(REAUTH_FLAG)) {
          throw new Error(
            "Signing in again did not produce a usable session. In Auth0, the API " +
              "needs Allow Offline Access enabled for refresh tokens to be issued."
          );
        }
        sessionStorage.setItem(REAUTH_FLAG, "1");
        await loginWithRedirect({
          appState: { returnTo: window.location.pathname + window.location.search },
        });
        // The redirect ends this page; nothing after it runs.
        return new Promise<string>(() => {});
      }
      throw err;
    }
  }, [getAccessTokenSilently, loginWithRedirect]);

  return useMemo<ApiClient>(
    () => ({
      get: (path) => request(getToken, "GET", path),
      post: (path, body) => request(getToken, "POST", path, body),
      patch: (path, body) => request(getToken, "PATCH", path, body),
      del: (path) => request(getToken, "DELETE", path),
      upload: (path, file) => uploadFile(getToken, path, file),
    }),
    [getToken]
  );
}
