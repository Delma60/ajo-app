"use client";

import { useState } from "react";
import {
  TrendingUpIcon,
  CalendarIcon,
  ArrowDownToLineIcon,
  Loader2,
  CheckCircle2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatNaira, cn } from "@/lib/utils";
import {
  RISK_META,
  CATEGORY_META,
  STATUS_META,
  type InvestmentWithProgress,
} from "@/lib/types/investment";
import { useWithdrawInvestment } from "@/lib/hooks/use-investments";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface YieldCardProps {
  investment: InvestmentWithProgress;
}

export function YieldCard({ investment: inv }: YieldCardProps) {
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false);
  const withdraw = useWithdrawInvestment();

  const riskMeta = RISK_META[inv.riskLevel];
  const categoryMeta = CATEGORY_META[inv.packageCategory];
  const statusMeta = STATUS_META[inv.status];

  const progressColorCls =
    inv.progressPercent >= 80
      ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
      : inv.progressPercent >= 50
      ? "[&>[data-slot=progress-indicator]]:bg-blue-500"
      : "[&>[data-slot=progress-indicator]]:bg-primary";

  const maturityDateStr = inv.maturityDate
    ?.toDate?.()
    ?.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) ?? "—";

  const startDateStr = inv.startDate
    ?.toDate?.()
    ?.toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
    }) ?? "—";

  async function handleWithdraw() {
    try {
      const result = await withdraw.mutateAsync(inv.id);
      setWithdrawConfirmOpen(false);
      toast.success(
        `₦${(result.netReturnKobo / 100).toLocaleString("en-NG")} credited to your wallet!`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Withdrawal failed. Try again."
      );
    }
  }

  const unrealisedGainKobo = inv.accruedValueKobo - inv.principalKobo;
  const gainPercent =
    inv.principalKobo > 0
      ? ((unrealisedGainKobo / inv.principalKobo) * 100).toFixed(2)
      : "0";

  return (
    <>
      <div
        className={cn(
          "rounded-xl border bg-card p-4 space-y-4",
          inv.isMatured &&
            inv.status === "active" &&
            "border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm">{categoryMeta.icon}</span>
              <p className="text-sm font-semibold">{inv.packageName}</p>
              <Badge
                variant="outline"
                className={cn("text-[10px] h-4 border-0", statusMeta.badgeCls)}
              >
                {inv.isMatured && inv.status === "active"
                  ? "Ready to Withdraw"
                  : statusMeta.label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <span
                  className={cn("size-1.5 rounded-full", riskMeta.dotCls)}
                />
                {riskMeta.label}
              </span>
              <span>·</span>
              <span>{inv.durationDays}-day term</span>
              <span>·</span>
              <span className="font-semibold text-foreground">
                {inv.annualYieldPercent}% p.a.
              </span>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Principal
            </p>
            <p className="text-sm font-semibold font-mono">
              {formatNaira(inv.principalKobo)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Current Value
            </p>
            <p className="text-sm font-semibold font-mono text-primary">
              {formatNaira(inv.accruedValueKobo)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Expected
            </p>
            <p className="text-sm font-semibold font-mono text-emerald-600 dark:text-emerald-400">
              {formatNaira(inv.expectedReturnKobo)}
            </p>
          </div>
        </div>

        {/* Gain badge */}
        {unrealisedGainKobo > 0 && (
          <div className="flex items-center gap-1.5">
            <TrendingUpIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              +{formatNaira(unrealisedGainKobo)} ({gainPercent}% accrued)
            </span>
          </div>
        )}

        {/* Progress */}
        {inv.status === "active" && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Started {startDateStr}</span>
              <span>
                {inv.isMatured
                  ? "Matured!"
                  : `${inv.daysRemaining}d remaining`}
              </span>
            </div>
            <Progress
              value={inv.progressPercent}
              className={cn("h-1.5", progressColorCls)}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{inv.progressPercent}% complete</span>
              <div className="flex items-center gap-1">
                <CalendarIcon className="size-3" />
                <span>Matures {maturityDateStr}</span>
              </div>
            </div>
          </div>
        )}

        {/* Completed state */}
        {(inv.status === "withdrawn" || inv.status === "matured") && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2.5">
            <CheckCircle2Icon className="size-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {inv.status === "withdrawn"
                ? `Withdrawn on ${inv.withdrawnAt?.toDate?.()?.toLocaleDateString("en-NG") ?? "—"}`
                : "Matured — ready to withdraw"}
            </p>
          </div>
        )}

        {/* Withdraw CTA */}
        {inv.status === "active" && inv.isMatured && (
          <Button
            className="w-full"
            onClick={() => setWithdrawConfirmOpen(true)}
            disabled={withdraw.isPending}
          >
            {withdraw.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowDownToLineIcon className="size-4" />
            )}
            {withdraw.isPending
              ? "Processing…"
              : `Withdraw ${formatNaira(inv.expectedReturnKobo)}`}
          </Button>
        )}

        {/* Locked state */}
        {inv.status === "active" && !inv.isMatured && (
          <div className="flex items-center justify-between rounded-lg bg-muted/30 border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Locked — {inv.daysRemaining}d to maturity
            </p>
            <Badge variant="outline" className="text-[10px]">
              {formatNaira(inv.expectedReturnKobo)} at maturity
            </Badge>
          </div>
        )}
      </div>

      {/* Withdraw confirm */}
      <AlertDialog
        open={withdrawConfirmOpen}
        onOpenChange={setWithdrawConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw investment?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Your <strong>{inv.packageName}</strong> investment has matured.
                  The following will be credited to your wallet:
                </p>
                <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Principal</span>
                    <span className="font-mono font-medium">
                      {formatNaira(inv.principalKobo)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Interest earned</span>
                    <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      +{formatNaira(inv.interestKobo)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Platform fee (1%)</span>
                    <span className="font-mono">
                      −{formatNaira(Math.round(inv.interestKobo * 0.01))}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
                    <span>You receive</span>
                    <span className="font-mono text-primary">
                      {formatNaira(
                        inv.principalKobo +
                          inv.interestKobo -
                          Math.round(inv.interestKobo * 0.01)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWithdraw}>
              Confirm Withdrawal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}