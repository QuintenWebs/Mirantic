import { type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation, Navigate } from "react-router-dom";
import { useMe } from "@/lib/me";
import { CenteredSpinner, ErrorState } from "@/components/states";

/** Requires an authenticated user. Redirects to /login if not signed in. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth0();
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
      <div className="flex h-screen w-screen items-center justify-center">
        <ErrorState message={meError} />
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

/** Requires the admin role. Clients are redirected to the site selector. */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { me, loading } = useMe();
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <CenteredSpinner />
      </div>
    );
  }
  if (me?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
