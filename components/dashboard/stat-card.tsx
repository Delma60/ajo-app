import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface StatCardData {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  iconColor?: string;
  iconBg?: string;
}

interface StatCardProps {
  data: StatCardData;
}

export function StatCard({ data }: StatCardProps) {
  const { label, value, sub, icon: Icon, trend, trendLabel, iconColor, iconBg } = data;

  return (
    <Card size="sm" className="relative overflow-hidden">
      <CardContent className="flex items-start justify-between gap-3 py-1">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
          <p className="text-lg font-bold text-foreground font-mono leading-tight">
            {value}
          </p>
          {sub && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
          )}
          {trendLabel && trend && (
            <div
              className={cn(
                "flex items-center gap-1 mt-1 text-[11px] font-medium",
                trend === "up" && "text-emerald-600",
                trend === "down" && "text-red-500",
                trend === "neutral" && "text-muted-foreground"
              )}
            >
              {trend === "up" && <TrendingUp className="size-3" />}
              {trend === "down" && <TrendingDown className="size-3" />}
              {trendLabel}
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            iconBg ?? "bg-primary/10"
          )}
        >
          <Icon
            className={cn("size-4", iconColor ?? "text-primary")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
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