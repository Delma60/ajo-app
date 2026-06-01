"use client";

import {
  BellIcon,
  BellOffIcon,
  BellRingIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AdminNotificationStats } from "@/lib/types/admin-notification";

interface NotificationStatsStripProps {
  stats: AdminNotificationStats | null;
  isLoading: boolean;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
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

export function NotificationStatsStrip({
  stats,
  isLoading,
  activeFilter,
  onFilterChange,
}: NotificationStatsStripProps) {
  const items: StatItem[] = [
    {
      key: "all",
      label: "All Notifications",
      value: stats?.total ?? 0,
      icon: BellIcon,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      activeRing: "ring-primary/30",
    },
    {
      key: "false",
      label: "Unread",
      value: stats?.unread ?? 0,
      icon: BellRingIcon,
      iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
      activeRing: "ring-red-300 dark:ring-red-800",
    },
    {
      key: "true",
      label: "Read",
      value: stats?.read ?? 0,
      icon: CheckCircle2Icon,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      activeRing: "ring-emerald-300 dark:ring-emerald-800",
    },
    {
      key: "dispute_raised",
      label: "Disputes",
      value: stats?.byType?.dispute_raised ?? 0,
      icon: BellOffIcon,
      iconBg: "bg-orange-100 dark:bg-orange-900/30",
      iconColor: "text-orange-600 dark:text-orange-400",
      activeRing: "ring-orange-300 dark:ring-orange-800",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <StatCard
          key={item.key}
          item={item}
          isLoading={isLoading}
          isActive={activeFilter === item.key}
          onClick={() =>
            onFilterChange(activeFilter === item.key ? "all" : item.key)
          }
        />
      ))}
    </div>
  );
}