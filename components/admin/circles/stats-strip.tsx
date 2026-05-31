"use client";

import {
  CircleDollarSignIcon,
  Users2Icon,
  PauseCircleIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Circle } from "@/lib/types/circle";
// import type { AdminCircle } from "./types";

interface CircleStatsStripProps {
  circles: Circle[];
  isLoading: boolean;
}

interface StatItem {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

function StatCard({
  item,
  isLoading,
}: {
  item: StatItem;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          {isLoading ? (
            <Skeleton className="h-6 w-14" />
          ) : (
            <p className="text-xl font-bold font-mono">
              {item.value.toLocaleString()}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            item.iconBg
          )}
        >
          <item.icon className={cn("size-4", item.iconColor)} />
        </div>
      </CardContent>
    </Card>
  );
}

export function CircleStatsStrip({
  circles,
  isLoading,
}: CircleStatsStripProps) {
  const active = circles.filter((c) => c.status === "active").length;
  const paused = circles.filter((c) => c.status === "paused").length;
  const completed = circles.filter((c) => c.status === "completed").length;
  const total = circles.length;

  const stats: StatItem[] = [
    {
      label: "Total circles",
      value: total,
      icon: CircleDollarSignIcon,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      label: "Active",
      value: active,
      icon: CircleDollarSignIcon,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Paused",
      value: paused,
      icon: PauseCircleIcon,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Completed",
      value: completed,
      icon: CheckCircle2Icon,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((item) => (
        <StatCard key={item.label} item={item} isLoading={isLoading} />
      ))}
    </div>
  );
}