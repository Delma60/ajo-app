"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { enrichInvestment } from "@/lib/services/investment-service";
import type {
  Investment,
  InvestmentPortfolioSummary,
  InvestmentWithProgress,
} from "@/lib/types/investments";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const investmentKeys = {
  all: ["investments"] as const,
  lists: () => [...investmentKeys.all, "list"] as const,
  mine: (userId: string) =>
    [...investmentKeys.lists(), "mine", userId] as const,
  summary: (userId: string) =>
    [...investmentKeys.all, "summary", userId] as const,
};

// ─── Real-time investments hook ───────────────────────────────────────────────

export function useMyInvestments() {
  const { firebaseUser } = useAuthStore();
  const [investments, setInvestments] = useState<InvestmentWithProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Refresh accrued values every minute without re-subscribing to Firestore
  const [tick, setTick] = useState(0);
  const rawRef = useRef<Investment[]>([]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setInvestments(rawRef.current.map(enrichInvestment));
  }, [tick]);

  useEffect(() => {
    if (!firebaseUser) {
      setInvestments([]);
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, "investments"),
      where("userId", "==", firebaseUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const raw = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Investment)
        );
        rawRef.current = raw;
        setInvestments(raw.map(enrichInvestment));
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [firebaseUser]);

  return { investments, isLoading, error };
}

// ─── Portfolio summary (REST) ─────────────────────────────────────────────────

export function usePortfolioSummary() {
  const { firebaseUser } = useAuthStore();

  return useQuery({
    queryKey: investmentKeys.summary(firebaseUser?.uid ?? ""),
    queryFn: async (): Promise<InvestmentPortfolioSummary> => {
      const res = await fetch("/api/investments/summary");
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to fetch summary");
      return json.data as InvestmentPortfolioSummary;
    },
    enabled: !!firebaseUser,
    staleTime: 30_000,
  });
}

// ─── Create investment mutation ───────────────────────────────────────────────

interface CreateInvestmentPayload {
  packageId: string;
  principalKobo: number;
}

export function useCreateInvestment() {
  const qc = useQueryClient();
  const { firebaseUser } = useAuthStore();

  return useMutation({
    mutationFn: async (payload: CreateInvestmentPayload) => {
      const res = await fetch("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to create investment");
      return json.data as { id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: investmentKeys.lists() });
      qc.invalidateQueries({
        queryKey: investmentKeys.summary(firebaseUser?.uid ?? ""),
      });
    },
  });
}

// ─── Withdraw investment mutation ─────────────────────────────────────────────

export function useWithdrawInvestment() {
  const qc = useQueryClient();
  const { firebaseUser } = useAuthStore();

  return useMutation({
    mutationFn: async (investmentId: string) => {
      const res = await fetch(`/api/investments/${investmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Withdrawal failed");
      return json.data as { netReturnKobo: number; feePaidKobo: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: investmentKeys.lists() });
      qc.invalidateQueries({
        queryKey: investmentKeys.summary(firebaseUser?.uid ?? ""),
      });
    },
  });
}