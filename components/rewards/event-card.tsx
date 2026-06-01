"use client";

import { Event } from "@/lib/types/event";
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
import { Trophy, Zap, InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

export function EventCard({
  event,
  isClaimed = false,
  onClaim,
}: EventCardProps) {
  const triggerDesc =
    TRIGGER_DESCRIPTIONS[event.triggerType] || event.triggerType;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2 mb-2">
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
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Reward */}
        <div className="flex items-center gap-2">
          {event.rewardType === "wallet_credit" ||
          event.rewardType === "both" ? (
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-amber-500" />
              <span className="text-sm font-medium">
                {event.rewardAmountKobo
                  ? formatNaira(event.rewardAmountKobo)
                  : "Reward"}
              </span>
            </div>
          ) : null}

          {event.rewardType === "badge" || event.rewardType === "both" ? (
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-amber-600" />
              <span className="text-sm font-medium">Badge</span>
            </div>
          ) : null}
        </div>

        {/* Status badge */}
        {isClaimed ? (
          <Badge variant="outline" className="text-xs">
            ✓ Earned
          </Badge>
        ) : event.maxClaimsTotal > 0 ? (
          <Badge variant="secondary" className="text-xs">
            Limited: {event.maxClaimsTotal} total
          </Badge>
        ) : null}

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
