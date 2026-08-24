import { type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation, Navigate } from "react-router-dom";
import { useMe } from "@/lib/me";
import { useViewMode } from "@/lib/view-mode";
import { CenteredSpinner, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";

/** Requires an authenticated user. Redirects to /login if not signed in. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, logout } = useAuth0();
  const { loading: meLoading, error: meError } = useMe();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <CenteredSpinner label="Signing in…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ returnTo: location.pathname + location.search }}
      />
    );
  }

  if (meError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4">
        <ErrorState message={meError} />
        <Button
          variant="outline"
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        >
          Sign out
        </Button>
      </div>
    );
  }

  if (meLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <CenteredSpinner label="Loading your account…" />
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Requires the admin role. Clients are redirected to the site selector, as is an
 * admin who has switched into client view — otherwise a stale URL would show
 * admin screens in a mode that is meant to reproduce what a client sees.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { me, loading } = useMe();
  const { mode } = useViewMode();
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <CenteredSpinner />
      </div>
    );
  }
  if (me?.role !== "admin" || mode === "client") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
