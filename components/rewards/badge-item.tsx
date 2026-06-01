"use client";

import { UserBadge, Badge } from "@/lib/types/event";
import { formatDistanceToNow } from "date-fns";
import { Badge as BadgeComponent } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface BadgeItemProps {
  badge: UserBadge & Badge;
}

const RARITY_COLORS = {
  common: "bg-slate-100 text-slate-800",
  rare: "bg-blue-100 text-blue-800",
  legendary: "bg-amber-100 text-amber-800",
};

export function BadgeItem({ badge }: BadgeItemProps) {
  const earnedDate = formatDistanceToNow(badge.earnedAt.toDate(), {
    addSuffix: true,
  });

  return (
    <Card className="flex flex-col items-center text-center p-4">
      <div className="text-5xl mb-3">{badge.iconEmoji || "🏆"}</div>

      <CardTitle className="text-sm mb-1">{badge.name}</CardTitle>

      <CardDescription className="text-xs mb-3">
        {badge.description}
      </CardDescription>

      <div className="flex items-center gap-2 mb-2">
        <BadgeComponent
          className={`text-xs capitalize ${RARITY_COLORS[badge.rarity]}`}
        >
          {badge.rarity}
        </BadgeComponent>
      </div>

      <p className="text-xs text-muted-foreground">Earned {earnedDate}</p>
    </Card>
  );
}
