import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useApi } from "./api";
import type { Me } from "./types";

interface MeContextValue {
  me: Me | null;
  loading: boolean;
  error: string | null;
}

const MeContext = createContext<MeContextValue>({
  me: null,
  loading: true,
  error: null,
});

/**
 * Loads the current user's DB profile (including role) once authenticated.
 * Provisioning happens server-side on first call to /api/me.
 */
export function MeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const api = useApi();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<Me>("/api/me")
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load profile");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  return (
    <MeContext.Provider value={{ me, loading, error }}>{children}</MeContext.Provider>
  );
}

export function useMe(): MeContextValue {
  return useContext(MeContext);
}
