"use client";

import {
  TrendingUpIcon,
  TrendingDownIcon,
  ClockIcon,
  CheckCircle2Icon,
  CoinsIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AdminInvestmentStats } from "@/lib/types/admin-investment";

interface InvestmentStatsStripProps {
  stats: AdminInvestmentStats | null;
  isLoading: boolean;
}

function fmtNaira(kobo: number): string {
  if (kobo >= 100_000_000) return `₦${(kobo / 100_000_000).toFixed(1)}M`;
  if (kobo >= 100_000) return `₦${(kobo / 100_000).toFixed(1)}k`;
  return `₦${(kobo / 100).toLocaleString("en-NG")}`;
}

interface StatItem {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

function StatCard({ item, isLoading }: { item: StatItem; isLoading: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          {isLoading ? (
            <>
              <Skeleton className="h-6 w-20" />
              {item.sub !== undefined && (
                <Skeleton className="h-3 w-16 mt-0.5" />
              )}
            </>
          ) : (
            <>
              <p className="text-lg font-bold font-mono leading-none">
                {item.value}
              </p>
              {item.sub && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {item.sub}
                </p>
              )}
            </>
          )}
        </div>
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            item.iconBg,
          )}
        >
          <item.icon className={cn("size-4", item.iconColor)} />
        </div>
      </CardContent>
    </Card>
  );
}

export function InvestmentStatsStrip({
  stats,
  isLoading,
}: InvestmentStatsStripProps) {
  const items: StatItem[] = [
    {
      label: "Total invested (active)",
      value: fmtNaira(stats?.totalActiveKobo ?? 0),
      sub: `${stats?.activeCount ?? 0} active positions`,
      icon: TrendingUpIcon,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Expected returns",
      value: fmtNaira(stats?.totalExpectedReturnKobo ?? 0),
      sub: "on active investments",
      icon: CoinsIcon,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Total paid out",
      value: fmtNaira(stats?.totalWithdrawnKobo ?? 0),
      sub: `${stats?.withdrawnCount ?? 0} withdrawn`,
      icon: TrendingDownIcon,
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Awaiting payout",
      value: (stats?.maturedCount ?? 0).toLocaleString(),
      sub: "matured, not withdrawn",
      icon: ClockIcon,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Platform fees earned",
      value: fmtNaira(stats?.platformFeesKobo ?? 0),
      sub: "1% on interest only",
      icon: CheckCircle2Icon,
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((item) => (
        <StatCard key={item.label} item={item} isLoading={isLoading} />
      ))}
    </div>
  );
}
