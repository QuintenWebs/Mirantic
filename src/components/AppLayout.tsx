import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";

/** Standard page chrome: header + a constrained content area. */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
