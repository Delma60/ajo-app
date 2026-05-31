"use client";

import {
  MoreHorizontalIcon,
  PauseIcon,
  PlayIcon,
  XCircleIcon,
  ExternalLinkIcon,
  ShieldCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatNaira } from "@/lib/utils";
import {
  AdminCircle,
  STATUS_META,
  FREQ_LABELS,
  PAYOUT_LABELS,
  TRUST_TIER,
} from "./types";

interface CircleRowProps {
  circle: AdminCircle;
  onAction: (id: string, action: "pause" | "unpause" | "cancel") => void;
  onOpenDetail: (circle: AdminCircle) => void;
  isProcessing: boolean;
}

export function CircleRow({
  circle,
  onAction,
  onOpenDetail,
  isProcessing,
}: CircleRowProps) {
  const statusMeta = STATUS_META[circle.status];
  const trustTier = TRUST_TIER(circle.trustScore);

  const trustBarCls =
    circle.trustScore >= 80
      ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
      : circle.trustScore >= 50
      ? "[&>[data-slot=progress-indicator]]:bg-amber-400"
      : "[&>[data-slot=progress-indicator]]:bg-red-500";

  const fillBarCls =
    circle.fillPercent >= 80
      ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
      : circle.fillPercent >= 50
      ? "[&>[data-slot=progress-indicator]]:bg-blue-500"
      : "[&>[data-slot=progress-indicator]]:bg-muted-foreground/40";

  const createdStr = circle.createdAt
    ? new Date(circle.createdAt).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 transition-colors",
        "hover:bg-muted/30"
      )}
    >
      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <button
          type="button"
          className="text-left group w-full"
          onClick={() => onOpenDetail(circle)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {circle.name}
            </p>
            {circle.isPrivate && (
              <span className="text-[10px] text-muted-foreground border border-border rounded px-1">
                Private
              </span>
            )}
            {(circle.pendingRequestIds?.length ?? 0) > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                {circle.pendingRequestIds.length} pending
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {circle.description || "No description"}
          </p>
        </button>
      </div>

      {/* Status badge */}
      <div className="hidden sm:block shrink-0">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
            statusMeta.cls
          )}
        >
          <span className={cn("size-1.5 rounded-full shrink-0", statusMeta.dotCls)} />
          {statusMeta.label}
        </span>
      </div>

      {/* Payout + Frequency */}
      <div className="hidden md:block shrink-0">
        <p className="text-xs font-medium text-foreground">
          {PAYOUT_LABELS[circle.payoutOrder]}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {FREQ_LABELS[circle.frequency]}
        </p>
      </div>

      {/* Member fill progress */}
      <div className="hidden lg:block shrink-0 w-28">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>
            {circle.memberCount}/{circle.maxMembers}
          </span>
          <span>{circle.fillPercent}%</span>
        </div>
        <Progress
          value={circle.fillPercent}
          className={cn("h-1.5", fillBarCls)}
        />
      </div>

      {/* Trust score */}
      <div className="hidden lg:block shrink-0 w-20 text-right">
        <p className={cn("text-sm font-bold font-mono", trustTier.cls)}>
          {circle.trustScore}
          <span className="text-[10px] font-normal text-muted-foreground">
            /100
          </span>
        </p>
        <p className="text-[10px] text-muted-foreground">{trustTier.label}</p>
      </div>

      {/* Contribution */}
      <div className="hidden xl:block shrink-0 text-right">
        <p className="text-xs font-semibold font-mono">
          {formatNaira(circle.contribution)}
        </p>
        <p className="text-[11px] text-muted-foreground">per cycle</p>
      </div>

      {/* Created */}
      <p className="hidden xl:block text-xs text-muted-foreground shrink-0 w-24 text-right">
        {createdStr}
      </p>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="shrink-0">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => onOpenDetail(circle)}>
            <ShieldCheckIcon className="size-4" />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/circles/${circle.id}`} target="_blank">
              <ExternalLinkIcon className="size-4" />
              Open circle page
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {circle.status === "active" && (
            <DropdownMenuItem
              disabled={isProcessing}
              onClick={() => onAction(circle.id, "pause")}
            >
              <PauseIcon className="size-4" />
              Pause circle
            </DropdownMenuItem>
          )}

          {circle.status === "paused" && (
            <DropdownMenuItem
              disabled={isProcessing}
              onClick={() => onAction(circle.id, "unpause")}
            >
              <PlayIcon className="size-4" />
              Resume circle
            </DropdownMenuItem>
          )}

          {circle.status !== "completed" && circle.status !== "cancelled" && (
            <DropdownMenuItem
              variant="destructive"
              disabled={isProcessing}
              onClick={() => onAction(circle.id, "cancel")}
            >
              <XCircleIcon className="size-4" />
              Cancel circle
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}