"use client";

import Link from "next/link";
import {
  Users2Icon,
  CalendarIcon,
  TrendingUpIcon,
  ShieldCheckIcon,
  LockIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatNaira } from "@/lib/utils";
import { FREQ_LABELS, STATUS_META, type CircleWithGoal } from "@/lib/types/circle";

interface CircleCardProps {
  circle: CircleWithGoal;
  isAdmin?: boolean;
  className?: string;
}

export function CircleCard({ circle, isAdmin, className }: CircleCardProps) {
  const progress =
    circle.goal > 0 ? Math.round((circle.saved / circle.goal) * 100) : 0;
  const spotsLeft = circle.maxMembers - circle.memberIds.length;
  const statusMeta = STATUS_META[circle.status];

  const progressColorCls =
    progress >= 80
      ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
      : progress >= 50
      ? "[&>[data-slot=progress-indicator]]:bg-amber-400"
      : "[&>[data-slot=progress-indicator]]:bg-blue-500";

  return (
    <Link href={`/circles/${circle.id}`} className="block group">
      <Card
        size="sm"
        className={cn(
          "hover:ring-primary/40 transition-all hover:ring-2 hover:shadow-sm",
          className
        )}
      >
        <CardContent className="space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {circle.isPrivate && (
                  <LockIcon className="size-3 text-muted-foreground shrink-0" />
                )}
                <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {circle.name}
                </p>
                {isAdmin && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">
                    Admin
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {circle.description}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn("text-[10px] h-5 shrink-0 border-0", statusMeta.badgeCls)}
            >
              {statusMeta.label}
            </Badge>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <TrendingUpIcon className="size-3 text-primary" />
              <span className="font-mono font-semibold text-foreground">
                {formatNaira(circle.contribution)}
              </span>
              <span>/ {FREQ_LABELS[circle.frequency].toLowerCase()}</span>
            </span>
            <span className="flex items-center gap-1">
              <Users2Icon className="size-3" />
              {circle.memberIds.length}/{circle.maxMembers}
            </span>
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3" />
              Cycle {circle.currentCycle}/{circle.totalCycles}
            </span>
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{formatNaira(circle.saved)} saved</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className={cn("h-1.5", progressColorCls)} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheckIcon className="size-3" />
              Trust {circle.trustScore}/100
            </div>
            {spotsLeft > 0 && circle.status === "active" ? (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} left
              </span>
            ) : circle.status === "active" ? (
              <span className="text-[11px] text-muted-foreground">Full</span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function CircleCardSkeleton({ className }: { className?: string }) {
  return (
    <Card size="sm" className={className}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="h-3 w-48 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="flex gap-3">
          <div className="h-3 w-20 bg-muted animate-pulse rounded" />
          <div className="h-3 w-12 bg-muted animate-pulse rounded" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-full bg-muted animate-pulse rounded" />
          <div className="h-1.5 w-full bg-muted animate-pulse rounded-full" />
        </div>
        <div className="h-3 w-24 bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  );
}