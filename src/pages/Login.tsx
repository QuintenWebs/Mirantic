import { useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CenteredSpinner } from "@/components/states";
import { Logo } from "@/components/Logo";

/**
 * There is no local sign-in form: Auth0's branded Universal Login is the sign-in
 * page, so this route goes straight there rather than making the user click
 * through an identical-looking card first.
 *
 * The redirect is deliberately NOT attempted when Auth0 has returned an error —
 * bouncing straight back would loop between the two, and the user would never
 * get to read what went wrong.
 */
export default function Login() {
  const { isAuthenticated, isLoading, loginWithRedirect, error } = useAuth0();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || "/";
  const [failed, setFailed] = useState<string | null>(null);
  const started = useRef(false);

  const blocked = Boolean(error) || Boolean(failed);

  useEffect(() => {
    if (isLoading || isAuthenticated || blocked || started.current) return;
    started.current = true;
    loginWithRedirect({ appState: { returnTo } }).catch((e: unknown) => {
      // Leaves the user on a page with a retry rather than a blank screen.
      console.error("loginWithRedirect failed:", e);
      setFailed(e instanceof Error ? e.message : "Could not reach the sign-in page.");
      started.current = false;
    });
  }, [isLoading, isAuthenticated, blocked, loginWithRedirect, returnTo]);

  if (isAuthenticated) {
    return <Navigate to={returnTo} replace />;
  }

  if (!blocked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <CenteredSpinner label="Taking you to sign in…" />
      </div>
    );
  }

  const message = error?.message ?? failed;
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6">
          <Logo height={20} />
        </div>
        <h1 className="text-lg font-semibold">Sign-in failed</h1>
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </p>
        <Button
          className="mt-6 w-full"
          onClick={() => {
            setFailed(null);
            started.current = false;
            loginWithRedirect({ appState: { returnTo } });
          }}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
