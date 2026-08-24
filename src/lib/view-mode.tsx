import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useMe } from "./me";

export type ViewMode = "admin" | "client";

const STORAGE_KEY = "mirantic.viewMode";

interface ViewModeContextValue {
  /** The effective mode. Always "client" for accounts that aren't admins. */
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  /** Only an admin has a second role to switch into. */
  canSwitch: boolean;
}

const ViewModeContext = createContext<ViewModeContextValue>({
  mode: "client",
  setMode: () => {},
  canSwitch: false,
});

/**
 * Which role the admin is currently working as. This is presentation only —
 * every endpoint still authorises from the user's real role in the database, so
 * switching to "client" narrows what is shown, it does not grant anything.
 */
export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { me } = useMe();
  const isAdmin = me?.role === "admin";
  const [stored, setStored] = useState<ViewMode>(() =>
    (localStorage.getItem(STORAGE_KEY) as ViewMode | null) ?? "admin"
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, stored);
  }, [stored]);

  const value = useMemo<ViewModeContextValue>(
    () => ({
      mode: isAdmin ? stored : "client",
      setMode: setStored,
      canSwitch: isAdmin,
    }),
    [isAdmin, stored]
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
  return useContext(ViewModeContext);
}
