"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Event, EventClaim, UserBadge, Badge } from "@/lib/types/event";

/**
 * Get all active events visible to the user (for the rewards hub)
 */
export function useActiveEvents() {
  return useQuery({
    queryKey: ["activeEvents"],
    queryFn: async () => {
      const response = await fetch("/api/events");
      if (!response.ok) {
        throw new Error("Failed to fetch active events");
      }

      const json = await response.json();
      return (json?.data ?? []) as Event[];
    },
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

/**
 * Get all badges earned by the current user
 */
export function useMyBadges() {
  const { appUser } = useAuthStore();

  return useQuery<(UserBadge & Badge)[]>({
    queryKey: ["myBadges", appUser?.id],
    queryFn: async () => {
      if (!appUser?.id) return [];

      try {
        const response = await fetch("/api/events/my-badges");
        if (!response.ok) throw new Error("Failed to fetch badges");
        const json = await response.json();
        return (json?.data ?? []) as (UserBadge & Badge)[];
      } catch (error) {
        console.error("Error fetching badges:", error);
        return [];
      }
    },
    enabled: !!appUser?.id,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

/**
 * Get all reward claims/transaction history for current user
 */
export function useRewardHistory() {
  const { appUser } = useAuthStore();

  return useQuery({
    queryKey: ["rewardHistory", appUser?.id],
    queryFn: async () => {
      if (!appUser?.id) return [];

      try {
        const response = await fetch("/api/events/my-claims");
        if (!response.ok) throw new Error("Failed to fetch reward history");
        return response.json();
      } catch (error) {
        console.error("Error fetching reward history:", error);
        return [];
      }
    },
    enabled: !!appUser?.id,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}

/**
 * Get count of claimed badges for a specific event
 * (used to show "already earned" state on event cards)
 */
export function useEventClaimStatus(eventId: string) {
  const { appUser } = useAuthStore();

  return useQuery({
    queryKey: ["eventClaim", eventId, appUser?.id],
    queryFn: async () => {
      if (!appUser?.id || !eventId) return null;

      try {
        const response = await fetch(
          `/api/events/${eventId}/claim-status?userId=${appUser.id}`,
        );
        if (!response.ok) return null;
        return response.json();
      } catch (error) {
        console.error("Error fetching claim status:", error);
        return null;
      }
    },
    enabled: !!appUser?.id && !!eventId,
    staleTime: 1000 * 60 * 5, // 5 min
  });
}
