"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNaira } from "@/lib/utils";
import { UsersIcon, TrendingUpIcon, CreditCard, Activity } from "lucide-react";

interface EventStatsStripProps {
  stats: {
    totalClaims: number;
    awardedClaims: number;
    totalRewardKobo: number;
    uniqueParticipants: number;
  };
}

export function EventStatsStrip({ stats }: EventStatsStripProps) {
  const conversionRate =
    stats.totalClaims > 0
      ? ((stats.awardedClaims / stats.totalClaims) * 100).toFixed(0)
      : "0";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
          <Activity className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalClaims}</div>
          <p className="text-xs text-muted-foreground">
            {stats.awardedClaims} awarded
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Participants</CardTitle>
          <UsersIcon className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.uniqueParticipants}</div>
          <p className="text-xs text-muted-foreground">unique users</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Rewards Issued</CardTitle>
          <CreditCard className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatNaira(stats.totalRewardKobo)}
          </div>
          <p className="text-xs text-muted-foreground">total spent</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Conversion</CardTitle>
          <TrendingUpIcon className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{conversionRate}%</div>
          <p className="text-xs text-muted-foreground">
            {stats.awardedClaims} of {stats.totalClaims}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
