import { useAuth0 } from "@auth0/auth0-react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, LayoutGrid, Users, Globe, LayoutDashboard, Shield, User } from "lucide-react";
import { useMe } from "@/lib/me";
import { useViewMode, type ViewMode } from "@/lib/view-mode";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initials(name: string, email: string): string {
  const base = name?.trim() || email;
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? "");
}

function NavLink({ to, icon: Icon, children }: { to: string; icon: typeof Users; children: string }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== "/" && pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

function RoleSwitcher() {
  const { mode, setMode } = useViewMode();
  const option = (value: ViewMode, label: string, Icon: typeof Shield) => (
    <button
      key={value}
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
        mode === value
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5" title="Switch role">
      {option("admin", "Admin", Shield)}
      {option("client", "Client", User)}
    </div>
  );
}

export function AppHeader() {
  const { logout, user } = useAuth0();
  const { me } = useMe();
  const { mode, canSwitch } = useViewMode();
  // Admin navigation belongs to the admin role only — hidden while an admin is
  // deliberately looking at the product as one of their clients.
  const isAdmin = me?.role === "admin" && mode === "admin";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 sm:px-6">
      <div className="flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
            M
          </div>
          <span className="text-sm font-semibold">Mirantic</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          <NavLink to="/" icon={LayoutGrid}>
            Sites
          </NavLink>
          {isAdmin && (
            <>
              <NavLink to="/admin" icon={LayoutDashboard}>
                Dashboard
              </NavLink>
              <NavLink to="/admin/clients" icon={Users}>
                Clients
              </NavLink>
              <NavLink to="/admin/sites" icon={Globe}>
                Sites
              </NavLink>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {canSwitch && <RoleSwitcher />}
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">{me?.name || user?.name}</p>
          <p className="text-xs text-muted-foreground">{me?.email}</p>
        </div>
        <Avatar>
          <AvatarFallback>{initials(me?.name ?? "", me?.email ?? "")}</AvatarFallback>
        </Avatar>
        <Button
          variant="ghost"
          size="icon"
          title="Sign out"
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
