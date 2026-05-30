"use client";

import { useAuthInit } from "@/lib/hooks/use-auth";

/**
 * Mounts the Firebase Auth + Firestore listeners.
 * Renders nothing — purely a side-effect component.
 * Place this once near the root of the app.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuthInit();
  return <>{children}</>;
}