"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  const [currentSettings, setCurrentSettings] =
    useState<PlatformSettings>(settings);

  useEffect(() => {
    setCurrentSettings(settings);
  }, [settings]);

  useEffect(() => {
    let active = true;

    async function refreshSettings() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        if (!response.ok) return;
        const json = await response.json();
        if (json?.success && json?.data && active) {
          setCurrentSettings(json.data);
        }
      } catch (err) {
        console.debug("[SettingsProvider] failed to refresh settings", err);
      }
    }

    refreshSettings();
    const interval = window.setInterval(refreshSettings, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <SettingsContext.Provider value={currentSettings}>
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
