"use client";

import { useMyBadges } from "@/lib/hooks/use-events";
import { BadgeItem } from "./badge-item";

export function BadgeCollection() {
  const { data: badges, isLoading } = useMyBadges();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-40 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!badges || badges.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Complete savings milestones to earn badges
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {badges.map((badge) => (
        <BadgeItem key={badge.badgeId} badge={badge} />
      ))}
    </div>
  );
}
