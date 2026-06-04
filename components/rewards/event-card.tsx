"use client";

import { useState, useEffect } from "react";
import { Event, Badge as BadgeType } from "@/lib/types/event";
import { formatNaira } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Zap, InfoIcon, Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConditionBadge } from "./condition-badge";

interface EventCardProps {
  event: Event;
  isClaimed?: boolean;
  onClaim?: () => void;
}

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  circle_completed: "Complete a full circle cycle",
  circle_moderated: "Admin a circle to completion",
  first_contribution: "Make your first contribution",
  contribution_streak: "Maintain on-time contributions",
  wallet_funded_threshold: "Fund your wallet above a threshold",
  wallet_total_saved_threshold: "Reach total savings milestone",
  referral_milestone: "Refer friends successfully",
  circle_filled: "Fill a circle to max members",
  first_circle_joined: "Join your first circle",
  onboarding_complete: "Complete onboarding",
  investment_made: "Make your first investment",
};

const RARITY_COLORS: Record<string, string> = {
  common: "bg-slate-100 text-slate-800 border-slate-200",
  rare: "bg-blue-100 text-blue-800 border-blue-200",
  legendary: "bg-amber-100 text-amber-800 border-amber-200",
};

export function EventCard({
  event,
  isClaimed = false,
  onClaim,
}: EventCardProps) {
  const [badge, setBadge] = useState<BadgeType | null>(null);
  const [loadingBadge, setLoadingBadge] = useState(false);

  const triggerDesc =
    TRIGGER_DESCRIPTIONS[event.triggerType] || event.triggerType;

  // Fetch badge details if badgeId exists
  useEffect(() => {
    if (
      event.badgeId &&
      (event.rewardType === "badge" || event.rewardType === "both")
    ) {
      setLoadingBadge(true);
      fetch(`/api/admin/badges/${event.badgeId}`)
        .then((res) => res.json())
        .then((data) => setBadge(data.data))
        .catch((err) => console.error("Failed to fetch badge:", err))
        .finally(() => setLoadingBadge(false));
    }
  }, [event.badgeId, event.rewardType]);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-base">{event.title}</CardTitle>
            <CardDescription className="text-xs">{triggerDesc}</CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoIcon className="size-4 text-muted-foreground shrink-0" />
              </TooltipTrigger>
              <TooltipContent>{event.description}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Conditions Badge */}
        <div className="flex flex-wrap gap-2">
          <ConditionBadge
            triggerType={event.triggerType}
            conditions={event.conditions}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Badge with Rarity */}
        {(event.rewardType === "badge" || event.rewardType === "both") && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              Badge Reward:
            </p>
            {loadingBadge ? (
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <Loader2 className="size-3 animate-spin" />
                <span className="text-xs text-muted-foreground">
                  Loading badge...
                </span>
              </div>
            ) : badge ? (
              <div
                className={`flex items-center gap-2 p-2 rounded border ${
                  RARITY_COLORS[badge.rarity] || "bg-slate-100"
                }`}
              >
                <span className="text-lg">{badge.iconEmoji || "🏆"}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{badge.name}</p>
                  <p className="text-xs opacity-75">{badge.description}</p>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs capitalize shrink-0"
                >
                  {badge.rarity}
                </Badge>
              </div>
            ) : null}
          </div>
        )}

        {/* Wallet Credit Reward */}
        {(event.rewardType === "wallet_credit" ||
          event.rewardType === "both") && (
          <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-200">
            <Zap className="size-4 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Wallet Reward:
              </p>
              <span className="text-sm font-semibold text-amber-900">
                {event.rewardAmountKobo
                  ? formatNaira(event.rewardAmountKobo)
                  : "Amount TBD"}
              </span>
            </div>
          </div>
        )}

        {/* Status & Limits */}
        <div className="flex flex-wrap gap-2 pt-2">
          {isClaimed ? (
            <Badge variant="outline" className="text-xs">
              ✓ Earned
            </Badge>
          ) : event.maxClaimsTotal > 0 ? (
            <Badge variant="secondary" className="text-xs">
              Limited: {event.maxClaimsTotal} total
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Unlimited claims
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            Max {event.maxClaimsPerUser}x per user
          </Badge>
        </div>

        {/* Claim button */}
        {!isClaimed && onClaim ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={onClaim}
          >
            Claim Manually
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
