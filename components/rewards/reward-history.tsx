"use client";

import { useRewardHistory } from "@/lib/hooks/use-events";
import { EventClaim, Event } from "@/lib/types/event";
import { formatNaira } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Zap, Trophy } from "lucide-react";

interface ClaimWithEvent extends EventClaim {
  event?: Event;
}

export function RewardHistory() {
  const { data: claims, isLoading } = useRewardHistory();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!claims || claims.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No reward transactions yet
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Reward</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(claims as ClaimWithEvent[]).map((claim) => (
            <TableRow key={claim.id}>
              <TableCell>
                <div>
                  <p className="text-sm font-medium">
                    {claim.event?.title || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {claim.event?.description || "—"}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {claim.rewardType === "wallet_credit" ||
                  claim.rewardType === "both" ? (
                    <div className="flex items-center gap-1 text-xs">
                      <Zap className="size-3 text-amber-500" />
                      {claim.rewardAmountKobo
                        ? formatNaira(claim.rewardAmountKobo)
                        : "—"}
                    </div>
                  ) : null}

                  {claim.rewardType === "badge" ||
                  claim.rewardType === "both" ? (
                    <div className="flex items-center gap-1 text-xs">
                      <Trophy className="size-3 text-amber-600" />
                      Badge
                    </div>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDistanceToNow(claim.createdAt.toDate(), {
                  addSuffix: true,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
