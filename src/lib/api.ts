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

export function useApi(): ApiClient {
  const { getAccessTokenSilently } = useAuth0();

  const getToken = useCallback<TokenGetter>(
    () => getAccessTokenSilently(),
    [getAccessTokenSilently]
  );

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
