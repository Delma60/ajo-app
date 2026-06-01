"use client";

import {
  GavelIcon,
  AlertCircleIcon,
  SearchIcon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AdminDisputeStats } from "@/lib/types/admin-dispute";

interface DisputeStatsStripProps {
  stats: AdminDisputeStats | null;
  isLoading: boolean;
  activeFilter: string;
  onFilterChange: (status: string) => void;
}

interface StatItem {
  key: string;
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  activeRing: string;
}

function StatCard({
  item,
  isLoading,
  isActive,
  onClick,
}: {
  item: StatItem;
  isLoading: boolean;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left transition-all duration-150 rounded-xl",
        isActive && item.activeRing
      )}
    >
      <Card
        className={cn(
          "transition-all duration-150",
          isActive
            ? "ring-2 shadow-sm"
            : "hover:shadow-sm hover:ring-1 hover:ring-border/80"
        )}
      >
        <CardContent className="flex items-start justify-between gap-3 py-3">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            {isLoading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <p className="text-2xl font-black font-mono leading-none tabular-nums">
                {item.value.toLocaleString()}
              </p>
            )}
          </div>
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
              item.iconBg
            )}
          >
            <item.icon className={cn("size-4", item.iconColor)} />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export function DisputeStatsStrip({
  stats,
  isLoading,
  activeFilter,
  onFilterChange,
}: DisputeStatsStripProps) {
  const items: StatItem[] = [
    {
      key: "all",
      label: "All Disputes",
      value: stats?.total ?? 0,
      icon: GavelIcon,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      activeRing: "ring-primary/30",
    },
    {
      key: "open",
      label: "Open",
      value: stats?.open ?? 0,
      icon: AlertCircleIcon,
      iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
      activeRing: "ring-red-300 dark:ring-red-800",
    },
    {
      key: "under_review",
      label: "Under Review",
      value: stats?.under_review ?? 0,
      icon: SearchIcon,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      activeRing: "ring-amber-300 dark:ring-amber-800",
    },
    {
      key: "resolved",
      label: "Resolved",
      value: stats?.resolved ?? 0,
      icon: CheckCircle2Icon,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      activeRing: "ring-emerald-300 dark:ring-emerald-800",
    },
    {
      key: "dismissed",
      label: "Dismissed",
      value: stats?.dismissed ?? 0,
      icon: XCircleIcon,
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
      activeRing: "ring-border",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((item) => (
        <StatCard
          key={item.key}
          item={item}
          isLoading={isLoading}
          isActive={activeFilter === item.key}
          onClick={() => onFilterChange(activeFilter === item.key ? "all" : item.key)}
        />
      ))}
    </div>
  );
}