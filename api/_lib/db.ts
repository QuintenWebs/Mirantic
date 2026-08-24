import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let instance: Database | null = null;

function getDb(): Database {
  if (instance) return instance;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Thrown on first use rather than at import time: a module-level throw
    // escapes withErrors() and Vercel reports an opaque
    // FUNCTION_INVOCATION_FAILED instead of a readable JSON error.
    throw new Error("DATABASE_URL is not set");
  }
  instance = drizzle(neon(connectionString), { schema });
  return instance;
}

/** Lazily-connected Drizzle client. Connects on first property access. */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
