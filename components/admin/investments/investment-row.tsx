"use client";

import {
  MoreHorizontalIcon,
  LogOutIcon,
  XCircleIcon,
  EyeIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  RISK_META,
  CATEGORY_META,
  type AdminInvestment,
} from "@/lib/types/admin-investment";

interface InvestmentRowProps {
  investment: AdminInvestment;
  onOpenDetail: (investment: AdminInvestment) => void;
  onAction: (id: string, action: "force_withdraw" | "cancel") => void;
  isProcessing: boolean;
}

function fmtNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function InvestmentRow({
  investment: inv,
  onOpenDetail,
  onAction,
  isProcessing,
}: InvestmentRowProps) {
  const statusMeta = STATUS_META[inv.status];
  const riskMeta = RISK_META[inv.riskLevel];
  const categoryMeta = CATEGORY_META[inv.packageCategory];

  const initials = inv.userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const progressBarCls =
    inv.progressPercent >= 100
      ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
      : inv.progressPercent >= 60
        ? "[&>[data-slot=progress-indicator]]:bg-blue-500"
        : "[&>[data-slot=progress-indicator]]:bg-muted-foreground/40";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 transition-colors hover:bg-muted/30 cursor-pointer group",
      )}
      onClick={() => onOpenDetail(inv)}
    >
      {/* User */}
      <div className="flex items-center gap-2.5 shrink-0 w-44">
        <Avatar className="size-8 shrink-0">
          <AvatarImage src={inv.userAvatarUrl ?? undefined} />
          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate leading-tight">
            {inv.userName}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {inv.userEmail}
          </p>
        </div>
      </div>

      {/* Package */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{categoryMeta.icon}</span>
          <p className="text-sm font-medium text-foreground truncate leading-tight">
            {inv.packageName}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-[10px] font-medium", riskMeta.cls)}>
            {riskMeta.label}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {inv.annualYieldPercent}% p.a. · {inv.durationDays}d
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="hidden sm:block shrink-0">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
            statusMeta.cls,
          )}
        >
          <span
            className={cn("size-1.5 rounded-full shrink-0", statusMeta.dotCls)}
          />
          {statusMeta.label}
        </span>
      </div>

      {/* Principal + expected return */}
      <div className="hidden md:block shrink-0 text-right">
        <p className="text-xs font-semibold font-mono">
          {fmtNaira(inv.principalKobo)}
        </p>
        <p className="text-[10px] text-muted-foreground">
          → {fmtNaira(inv.expectedReturnKobo)}
        </p>
      </div>

      {/* Progress */}
      <div className="hidden lg:block shrink-0 w-28">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>{inv.progressPercent}%</span>
          {inv.status === "active" && <span>{inv.daysRemaining}d left</span>}
        </div>
        <Progress
          value={inv.progressPercent}
          className={cn("h-1.5", progressBarCls)}
        />
      </div>

      {/* Maturity date */}
      <div className="hidden xl:block shrink-0 text-right">
        <p className="text-xs text-muted-foreground">Matures</p>
        <p
          className={cn(
            "text-xs font-medium",
            inv.isMatured && inv.status === "active"
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground",
          )}
        >
          {fmtDate(inv.maturityDate)}
        </p>
      </div>

      {/* Actions */}
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onOpenDetail(inv)}>
              <EyeIcon className="size-4" />
              View details
            </DropdownMenuItem>
            {inv.status === "active" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={isProcessing}
                  onClick={() => onAction(inv.id, "force_withdraw")}
                >
                  <LogOutIcon className="size-4" />
                  Force payout
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={isProcessing}
                  onClick={() => onAction(inv.id, "cancel")}
                >
                  <XCircleIcon className="size-4" />
                  Cancel & refund
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
