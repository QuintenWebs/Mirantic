import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/states";

export default function Login() {
  const { isAuthenticated, isLoading, loginWithRedirect, error } = useAuth0();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || "/";

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <CenteredSpinner />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={returnTo} replace />;
  }

  async function handleLogin() {
    setSubmitting(true);
    try {
      await loginWithRedirect({ appState: { returnTo } });
    } catch (e) {
      // Surface, rather than silently swallow, a failed redirect.
      console.error("loginWithRedirect failed:", e);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-bold text-primary-foreground">
            M
          </div>
          <span className="text-base font-semibold">Mirantic CMS</span>
        </div>
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage and publish content for your website.
        </p>

        {error && (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error.message}
          </p>
        )}

        <Button className="mt-6 w-full" onClick={handleLogin} disabled={submitting}>
          {submitting ? "Redirecting…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
