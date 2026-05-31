"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  startAfter,
  QueryConstraint,
  onSnapshot,
  DocumentSnapshot,
} from "firebase/firestore";
import { useInfiniteQuery } from "@tanstack/react-query";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import type { Transaction } from "@/lib/types/transaction";

const PAGE_SIZE = 20;

export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionKeys.all, "list"] as const,
  list: (userId: string, filters: Record<string, unknown>) =>
    [...transactionKeys.lists(), userId, filters] as const,
};

export function useTransactions(filters?: {
  type?: Transaction["type"];
  status?: Transaction["status"];
}) {
  const { firebaseUser } = useAuthStore();

  return useInfiniteQuery({
    queryKey: transactionKeys.list(firebaseUser?.uid ?? "", filters ?? {}),
    queryFn: async ({ pageParam }) => {
      if (!firebaseUser) return { transactions: [], lastDoc: null };

      const constraints: QueryConstraint[] = [
        where("userId", "==", firebaseUser.uid),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE),
      ];

      if (filters?.type) {
        constraints.push(where("type", "==", filters.type));
      }

      if (filters?.status) {
        constraints.push(where("status", "==", filters.status));
      }

      if (pageParam) {
        constraints.push(startAfter(pageParam));
      }

      const q = query(collection(db, "transactions"), ...constraints);
      const snap = await getDocs(q);

      const transactions = snap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Transaction)
      );
      const lastDoc =
        snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;

      return { transactions, lastDoc };
    },
    initialPageParam: null as DocumentSnapshot | null,
    getNextPageParam: (lastPage) => lastPage.lastDoc,
    enabled: !!firebaseUser,
  });
}

// Hook for realtime recent transactions (dashboard usage)
export function useRecentTransactions(count: number = 5) {
  const { firebaseUser } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) {
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, "transactions"),
      where("userId", "==", firebaseUser.uid),
      orderBy("createdAt", "desc"),
      limit(count)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as Transaction)
        );
        setTransactions(data);
        setIsLoading(false);
      },
      (err) => {
        console.error("Error fetching recent transactions:", err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [firebaseUser, count]);

  return { transactions, isLoading };
}