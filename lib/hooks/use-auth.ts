"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, auth } from "@/lib/firebase/auth";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { User as AppUser } from "@/lib/types/user";

/**
 * Initializes the auth listener. Mount this once at the root layout level.
 * Syncs Firebase Auth state → Zustand store, then subscribes to the
 * Firestore user document for real-time profile updates.
 */
export function useAuthInit() {
  const { setFirebaseUser, setAppUser, setLoading, setInitialized, reset } =
    useAuthStore();

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up any previous Firestore subscription
      unsubscribeFirestore?.();
      unsubscribeFirestore = null;

      if (!firebaseUser) {
        reset();
        return;
      }

      setFirebaseUser(firebaseUser);
      setLoading(true);

      // Subscribe to the Firestore user doc for live updates
      unsubscribeFirestore = onSnapshot(
        doc(db, "users", firebaseUser.uid),
        (snap) => {
          if (snap.exists()) {
            setAppUser(snap.data() as AppUser);
          }
          setLoading(false);
          setInitialized(true);
        },
        () => {
          // Firestore read failed (e.g. rules) — still mark as initialized
          setLoading(false);
          setInitialized(true);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeFirestore?.();
    };
  }, [setFirebaseUser, setAppUser, setLoading, setInitialized, reset]);
}

/**
 * Returns the current auth state from the Zustand store.
 * Components call this; only `useAuthInit` does the wiring.
 */
export function useAuth() {
  const { firebaseUser, appUser, isLoading, isInitialized } = useAuthStore();

  return {
    user: firebaseUser,
    appUser,
    isLoading,
    isInitialized,
    isAuthenticated: !!firebaseUser,
  };
}