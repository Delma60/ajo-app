"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { Wallet } from "@/lib/types/wallet";

export function useWallet() {
  const { firebaseUser } = useAuthStore();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setWallet(null);
      setIsLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "wallets", firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setWallet(snap.data() as Wallet);
        } else {
          setWallet(null);
        }
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [firebaseUser]);

  return { wallet, isLoading, error };
}