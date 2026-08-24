import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";

/** Standard page chrome: a left sidebar and a constrained content area. */
export function AppLayout({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden shrink-0 lg:block">
        <AppSidebar />
      </aside>

      {/* Below lg the sidebar becomes a drawer, so narrow screens keep the full
          width for the editor rather than losing 16rem of it to navigation. */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setNavOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 shadow-xl">
            <AppSidebar onNavigate={() => setNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold">Mirantic</span>
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
