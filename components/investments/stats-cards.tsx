"use client";

import {
  TrendingUpIcon,
  WalletIcon,
  PiggyBankIcon,
  PercentIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNaira, cn } from "@/lib/utils";
import type { InvestmentPortfolioSummary } from "@/lib/types/investment";

interface StatsCardsProps {
  summary: InvestmentPortfolioSummary | undefined;
  isLoading: boolean;
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  highlight?: boolean;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  highlight,
}: StatCardProps) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3 py-1">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-lg font-bold font-mono leading-tight",
              highlight ? "text-primary" : "text-foreground"
            )}
          >
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            iconBg
          )}
        >
          <Icon className={cn("size-4", iconColor)} />
        </div>
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3 py-1">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="size-9 rounded-xl shrink-0" />
      </CardContent>
    </Card>
  );
}

export function InvestmentStatsCards({ summary, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const totalPortfolio = summary?.totalAccruedKobo ?? 0;
  const totalInvested = summary?.totalInvestedKobo ?? 0;
  const totalEarned =
    (summary?.totalInterestEarnedKobo ?? 0) +
    Math.max(0, (summary?.totalAccruedKobo ?? 0) - (summary?.totalInvestedKobo ?? 0));
  const avgYield = summary?.averageYieldPercent ?? 0;
  const activeCount = summary?.activeCount ?? 0;
  const withdrawnCount = summary?.withdrawnCount ?? 0;

  const stats: StatCardProps[] = [
    {
      label: "Portfolio Value",
      value: formatNaira(totalPortfolio),
      sub: `${activeCount} active position${activeCount !== 1 ? "s" : ""}`,
      icon: TrendingUpIcon,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      highlight: true,
    },
    {
      label: "Total Invested",
      value: formatNaira(totalInvested),
      sub: "Principal deployed",
      icon: WalletIcon,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Interest Earned",
      value: formatNaira(totalEarned),
      sub: `${withdrawnCount} completed`,
      icon: PiggyBankIcon,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Avg. Yield",
      value: avgYield > 0 ? `${avgYield}%` : "—",
      sub: "Annual return rate",
      icon: PercentIcon,
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}