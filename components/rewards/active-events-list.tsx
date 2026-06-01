"use client";

import { useActiveEvents } from "@/lib/hooks/use-events";
import { useAuthStore } from "@/lib/stores/auth-store";
import { EventCard } from "./event-card";
import { useQuery } from "@tanstack/react-query";

export function ActiveEventsList() {
  const { appUser } = useAuthStore();
  const { data: events, isLoading } = useActiveEvents();

  // Get claimed event IDs for current user
  const { data: claimedEventIds = [] } = useQuery({
    queryKey: ["claimedEventIds", appUser?.id],
    queryFn: async () => {
      if (!appUser?.id) return [];
      try {
        const response = await fetch("/api/events/my-claims");
        const result = await response.json();
        if (result.success) {
          return result.data.map((claim: any) => claim.eventId);
        }
        return [];
      } catch {
        return [];
      }
    },
    enabled: !!appUser?.id,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No active events right now. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          isClaimed={claimedEventIds.includes(event.id)}
        />
      ))}
    </div>
  );
}
