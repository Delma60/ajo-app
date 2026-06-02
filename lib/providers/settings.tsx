"use client";

import { createContext, useContext } from "react";
import type { PlatformSettings } from "@/lib/types/admin-settings";

interface SettingsProviderProps {
  children: React.ReactNode;
  settings: PlatformSettings;
}

const SettingsContext = createContext<PlatformSettings | null>(null);

export function SettingsProvider({
  children,
  settings,
}: SettingsProviderProps) {
  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
