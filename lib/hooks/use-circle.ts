"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import type { Circle, CircleWithGoal } from "@/lib/types/circle";

// ─── Query keys ───────────────────────────────────────────────────────────────

export const circleKeys = {
  all: ["circles"] as const,
  lists: () => [...circleKeys.all, "list"] as const,
  myCircles: (userId: string) =>
    [...circleKeys.lists(), "mine", userId] as const,
  public: () => [...circleKeys.lists(), "public"] as const,
  detail: (id: string) => [...circleKeys.all, "detail", id] as const,
};

// ─── Enrich circle with derived goal field ────────────────────────────────────

function withGoal(circle: Circle): CircleWithGoal {
  return { ...circle, goal: circle.contribution * circle.maxMembers };
}

// ─── Real-time my circles hook (Firestore onSnapshot) ────────────────────────

export function useMyCircles(circleIds: string[]) {
  const [circles, setCircles] = useState<CircleWithGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!circleIds.length) {
      setCircles([]);
      setIsLoading(false);
      return;
    }

    // Firestore "in" query supports max 30 items; take first 30
    const ids = circleIds.slice(0, 30);

    const unsub = onSnapshot(
      query(collection(db, "circles"), where("__name__", "in", ids)),
      (snap) => {
        const data = snap.docs.map((d) =>
          withGoal({ id: d.id, ...d.data() } as Circle)
        );
        setCircles(data);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [circleIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return { circles, isLoading, error };
}

// ─── Real-time single circle hook ────────────────────────────────────────────

export function useCircleRealtime(circleId: string | null) {
  const [circle, setCircle] = useState<CircleWithGoal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!circleId) {
      setIsLoading(false);
      return;
    }

    console.debug(`[useCircleRealtime] subscribing to circleId=${circleId}`);
    const unsub = onSnapshot(
      doc(db, "circles", circleId),
      (snap) => {
        if (snap.exists()) {
          console.debug(`[useCircleRealtime] circle exists id=${snap.id}`);
          setCircle(withGoal({ id: snap.id, ...snap.data() } as Circle));
        } else {
          console.warn(`[useCircleRealtime] circle missing id=${circleId}`);
          setCircle(null);
        }
        setIsLoading(false);
      },
      (err) => {
        console.error("[useCircleRealtime] snapshot error", err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [circleId]);

  return { circle, isLoading, error };
}

// ─── Public circles (REST via API route) ─────────────────────────────────────

export function usePublicCircles(search = "") {
  return useQuery({
    queryKey: [...circleKeys.public(), search],
    queryFn: async () => {
      const res = await fetch(`/api/circles?q=${encodeURIComponent(search)}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load circles");
      return (json.data ?? []) as CircleWithGoal[];
    },
    staleTime: 30_000,
  });
}

// ─── Create circle mutation ───────────────────────────────────────────────────

interface CreateCirclePayload {
  name: string;
  description: string;
  contribution: number; // kobo
  maxMembers: number;
  frequency: Circle["frequency"];
  payoutOrder: Circle["payoutOrder"];
  isPrivate: boolean;
  invitePermission: Circle["invitePermission"];
  tags: string[];
  joinFeeEnabled: boolean;
  joinFee: number;
  joinFeeType: Circle["joinFeeType"];
}

export function useCreateCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCirclePayload) => {
      const res = await fetch("/api/circles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to create circle");
      return json.data as { id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: circleKeys.lists() });
    },
  });
}

// ─── Join circle mutation ─────────────────────────────────────────────────────

export function useJoinCircle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      circleId,
      inviteCode,
    }: {
      circleId: string;
      inviteCode?: string;
    }) => {
      const res = await fetch(`/api/circles/${circleId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteCode ? { inviteCode } : {}),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to join circle");
      return json;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: circleKeys.lists() });
      qc.invalidateQueries({ queryKey: circleKeys.detail(variables.circleId) });
    },
  });
}

// ─── Contribute to circle mutation ───────────────────────────────────────────

export function useContribute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      circleId,
      amount,
    }: {
      circleId: string;
      amount: number;
    }) => {
      const res = await fetch(`/api/circles/${circleId}/contribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Contribution failed");
      return json;
    },
    onSuccess: (_data, { circleId }) => {
      qc.invalidateQueries({ queryKey: circleKeys.detail(circleId) });
    },
  });
}

// ─── Place bid mutation ───────────────────────────────────────────────────────

export function usePlaceBid() {
  return useMutation({
    mutationFn: async ({
      circleId,
      amount,
    }: {
      circleId: string;
      amount: number;
    }) => {
      const res = await fetch(`/api/circles/${circleId}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Bid failed");
      return json;
    },
  });
}