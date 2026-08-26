import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link, useLocation } from "react-router-dom";
import {
  LogOut, LayoutGrid, Users, Globe, LayoutDashboard,
  ChevronDown, Settings, Shield, User, BookOpen,
} from "lucide-react";
import { useMe } from "@/lib/me";
import { useViewMode, type ViewMode } from "@/lib/view-mode";
import { cn } from "@/lib/utils";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Logo } from "@/components/Logo";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

function initials(name: string, email: string): string {
  const base = name?.trim() || email;
  const parts = base.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0]?.toUpperCase() ?? "");
}

function NavItem({
  to, icon: Icon, children, onNavigate,
}: {
  to: string;
  icon: typeof Users;
  children: string;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-raised text-sidebar-foreground"
          : "text-sidebar-muted hover:bg-sidebar-raised/60 hover:text-sidebar-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
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
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors",
        mode === value
          ? "bg-sidebar-raised text-sidebar-foreground"
          : "text-sidebar-muted hover:text-sidebar-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
  return (
    <div>
      <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-sidebar-muted">
        Viewing as
      </p>
      <div className="flex items-center gap-0.5 rounded-md border border-sidebar-border p-0.5">
        {option("admin", "Admin", Shield)}
        {option("client", "Client", User)}
      </div>
    </div>
  );
}

/**
 * Name, email and avatar as one clickable card: the whole thing is the menu
 * trigger, rather than a separate caret only power users would find.
 */
function UserCard() {
  const { logout } = useAuth0();
  const { me } = useMe();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border border-sidebar-border p-2.5 text-left transition-colors",
              "hover:bg-sidebar-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-border",
              "data-[state=open]:bg-sidebar-raised"
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {me?.name || me?.email}
              </p>
              <p className="truncate text-xs text-sidebar-muted">{me?.email}</p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials(me?.name ?? "", me?.email ?? "")}
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-sidebar-muted" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="top" className="w-[--radix-dropdown-menu-trigger-width]">
          <DropdownMenuLabel>{me?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            onSelect={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { me } = useMe();
  const { mode, canSwitch } = useViewMode();
  const isAdmin = me?.role === "admin" && mode === "admin";

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar">
      <div className="flex h-14 items-center gap-2 px-4">
        <Link to="/" onClick={onNavigate} aria-label="Mirantic">
          <Logo tone="light" height={18} />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <NavItem to="/" icon={LayoutGrid} onNavigate={onNavigate}>
          Sites
        </NavItem>
        {isAdmin && (
          <>
            <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wide text-sidebar-muted">
              Admin
            </p>
            <NavItem to="/admin" icon={LayoutDashboard} onNavigate={onNavigate}>
              Dashboard
            </NavItem>
            <NavItem to="/admin/clients" icon={Users} onNavigate={onNavigate}>
              Users
            </NavItem>
            <NavItem to="/admin/sites" icon={Globe} onNavigate={onNavigate}>
              Manage sites
            </NavItem>
            <NavItem to="/admin/guide" icon={BookOpen} onNavigate={onNavigate}>
              Setup guide
            </NavItem>
          </>
        )}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-3">
        {canSwitch && <RoleSwitcher />}
        <UserCard />
      </div>
    </div>
  );
}
