import type { VercelRequest, VercelResponse } from "@vercel/node";
import { HttpError } from "./auth";

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;

/**
 * Wraps a serverless handler with consistent JSON error handling.
 * Throw HttpError(status, message) anywhere inside to return a clean error.
 */
export function withErrors(handler: Handler): Handler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      console.error("Unhandled API error:", err);
      const message =
        err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  };
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]): void {
  res.setHeader("Allow", allowed.join(", "));
  res.status(405).json({ error: "Method not allowed" });
}

export function readBody<T = Record<string, unknown>>(req: VercelRequest): T {
  if (!req.body) return {} as T;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      return {} as T;
    }
  }
  return req.body as T;
}
