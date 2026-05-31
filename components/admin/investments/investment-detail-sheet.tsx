"use client";

import { useState, useEffect } from "react";
import {
  RefreshCwIcon,
  AlertCircleIcon,
  LogOutIcon,
  XCircleIcon,
  WalletIcon,
  CalendarIcon,
  TrendingUpIcon,
  ShieldIcon,
  CopyIcon,
  CheckIcon,
  UserIcon,
  PhoneIcon,
  MailIcon,
  ClockIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  RISK_META,
  CATEGORY_META,
  type AdminInvestment,
} from "@/lib/types/admin-investment";

// ─── Extended detail type from API ────────────────────────────────────────────

interface InvestmentDetail extends AdminInvestment {
  userPhone: string;
  walletBalance: number;
  platformFeeKobo: number;
  netReturnKobo: number;
}

interface InvestmentDetailSheetProps {
  investment: AdminInvestment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: (id: string, newStatus: "withdrawn" | "cancelled") => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(kobo / 100);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? (
        <CheckIcon className="size-3 text-emerald-500" />
      ) : (
        <CopyIcon className="size-3" />
      )}
    </button>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
  copyable,
  valueClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide leading-none mb-0.5">
          {label}
        </p>
        <p
          className={cn(
            "text-sm text-foreground truncate",
            mono && "font-mono font-medium",
            valueClassName,
          )}
        >
          {value || "—"}
        </p>
      </div>
      {copyable && value && <CopyButton value={value} />}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-5 p-1">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="size-7 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Returns breakdown card ───────────────────────────────────────────────────

function ReturnsCard({ detail }: { detail: InvestmentDetail }) {
  const progressBarCls =
    detail.progressPercent >= 100
      ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
      : "[&>[data-slot=progress-indicator]]:bg-blue-500";

  return (
    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 dark:from-emerald-950/30 dark:to-emerald-900/20 dark:border-emerald-800/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUpIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
            Investment Returns
          </p>
        </div>
        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
          {detail.annualYieldPercent}% p.a.
        </span>
      </div>

      {/* Amount grid */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">Principal</p>
          <p className="text-base font-bold font-mono text-foreground">
            {fmtNaira(detail.principalKobo)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">Interest</p>
          <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
            +{fmtNaira(detail.interestKobo)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">
            Platform fee (1%)
          </p>
          <p className="text-sm font-mono text-muted-foreground">
            −{fmtNaira(detail.platformFeeKobo)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">Net payout</p>
          <p className="text-base font-bold font-mono text-foreground">
            {fmtNaira(detail.netReturnKobo)}
          </p>
        </div>
      </div>

      {/* Progress */}
      {detail.status === "active" && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">
              Accrued: {fmtNaira(detail.accruedValueKobo)}
            </span>
            <span className="text-muted-foreground">
              {detail.progressPercent}% through term
            </span>
          </div>
          <Progress
            value={detail.progressPercent}
            className={cn("h-2", progressBarCls)}
          />
          {detail.isMatured ? (
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              ⏰ Matured — awaiting user withdrawal
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {detail.daysRemaining} day{detail.daysRemaining !== 1 ? "s" : ""}{" "}
              remaining
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

export function InvestmentDetailSheet({
  investment,
  open,
  onOpenChange,
  onActionComplete,
}: InvestmentDetailSheetProps) {
  const [detail, setDetail] = useState<InvestmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [confirmAction, setConfirmAction] = useState<
    "force_withdraw" | "cancel" | null
  >(null);
  const [adminNote, setAdminNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !investment) return;
    setDetail(null);
    setHasError(false);
    setAdminNote("");
    loadDetail(investment.id);
  }, [open, investment?.id]);

  async function loadDetail(id: string) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/investments/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load");
      setDetail(json.data as InvestmentDetail);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmedAction() {
    if (!confirmAction || !investment) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/investments/${investment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirmAction, adminNote }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Action failed");

      const labels = {
        force_withdraw: "Investment paid out successfully",
        cancel: "Investment cancelled and principal refunded",
      };
      toast.success(labels[confirmAction]);

      const newStatus =
        confirmAction === "force_withdraw" ? "withdrawn" : "cancelled";
      onActionComplete(investment.id, newStatus);
      setConfirmAction(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!investment) return null;

  const current = detail ?? investment;
  const statusMeta = STATUS_META[current.status];
  const categoryMeta = CATEGORY_META[current.packageCategory];
  const riskMeta = RISK_META[current.riskLevel];

  const initials = current.userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const ACTION_META = {
    force_withdraw: {
      label: "Force Payout",
      description:
        "This will immediately credit the user's accrued investment value (pro-rated to today) minus the 1% platform fee. The investment will be marked as withdrawn. Use this for dispute resolution or hardship cases.",
      destructive: false,
      confirmLabel: "Yes, Process Payout",
    },
    cancel: {
      label: "Cancel & Refund Principal",
      description:
        "This will cancel the investment and refund only the original principal to the user's wallet. No interest will be paid. Use this for erroneous investments or fraud cases.",
      destructive: true,
      confirmLabel: "Yes, Cancel & Refund",
    },
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg flex flex-col p-0 gap-0"
        >
          {/* Header */}
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
            {isLoading && !detail ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-64" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* User identity */}
                <div className="flex items-center gap-3">
                  <Avatar className="size-12 shrink-0">
                    <AvatarImage src={current.userAvatarUrl ?? undefined} />
                    <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-base font-semibold truncate leading-tight">
                      {current.userName}
                    </SheetTitle>
                    <SheetDescription className="text-xs truncate mt-0.5">
                      {current.userEmail}
                    </SheetDescription>
                  </div>
                </div>

                {/* Package + badges */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-base">{categoryMeta.icon}</span>
                    <p className="text-sm font-semibold text-foreground">
                      {current.packageName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        statusMeta.cls,
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          statusMeta.dotCls,
                        )}
                      />
                      {statusMeta.label}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted",
                        riskMeta.cls,
                      )}
                    >
                      {riskMeta.label}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                      {current.annualYieldPercent}% p.a.
                    </span>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                      {current.durationDays} days
                    </span>
                  </div>
                </div>
              </div>
            )}
          </SheetHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {isLoading && !detail ? (
              <DetailSkeleton />
            ) : hasError ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <AlertCircleIcon className="size-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Failed to load details</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check your connection and try again.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => loadDetail(investment.id)}
                >
                  <RefreshCwIcon className="size-3.5" />
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {/* Returns card */}
                {detail && <ReturnsCard detail={detail} />}

                {/* Wallet snapshot */}
                {detail && (
                  <div className="rounded-xl border border-border p-3 flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <WalletIcon className="size-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Current wallet balance
                      </p>
                      <p className="text-base font-bold font-mono text-foreground">
                        {fmtNaira(detail.walletBalance)}
                      </p>
                    </div>
                  </div>
                )}

                {/* User contact */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    User Contact
                  </p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <InfoRow
                      icon={MailIcon}
                      label="Email"
                      value={current.userEmail}
                      copyable
                    />
                    {detail?.userPhone && (
                      <InfoRow
                        icon={PhoneIcon}
                        label="Phone"
                        value={detail.userPhone}
                        copyable
                      />
                    )}
                    <InfoRow
                      icon={UserIcon}
                      label="User ID"
                      value={current.userId}
                      mono
                      copyable
                    />
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Timeline
                  </p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <InfoRow
                      icon={CalendarIcon}
                      label="Invested on"
                      value={fmtDate(current.startDate)}
                    />
                    <InfoRow
                      icon={ClockIcon}
                      label="Maturity date"
                      value={fmtDate(current.maturityDate)}
                      valueClassName={
                        current.isMatured && current.status === "active"
                          ? "text-amber-600 dark:text-amber-400"
                          : undefined
                      }
                    />
                    {current.withdrawnAt && (
                      <InfoRow
                        icon={CalendarIcon}
                        label="Withdrawn at"
                        value={fmtDateTime(current.withdrawnAt)}
                      />
                    )}
                    {current.cancelledAt && (
                      <InfoRow
                        icon={CalendarIcon}
                        label="Cancelled at"
                        value={fmtDateTime(current.cancelledAt)}
                      />
                    )}
                  </div>
                </div>

                {/* Transaction reference */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    References
                  </p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <InfoRow
                      icon={ShieldIcon}
                      label="Investment ID"
                      value={current.id}
                      mono
                      copyable
                    />
                    <InfoRow
                      icon={ShieldIcon}
                      label="Transaction ID"
                      value={current.transactionId}
                      mono
                      copyable
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Admin action footer — only for active investments */}
          {current.status === "active" && !hasError && (
            <div className="shrink-0 border-t border-border px-5 py-4 bg-muted/30 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Admin Actions
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={() => setConfirmAction("force_withdraw")}
                >
                  <LogOutIcon className="size-3.5 text-blue-600" />
                  Force Payout
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => setConfirmAction("cancel")}
                >
                  <XCircleIcon className="size-3.5" />
                  Cancel & Refund
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                These actions are irreversible and will notify the user.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction ? ACTION_META[confirmAction].label : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction ? ACTION_META[confirmAction].description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Admin note */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">
              Admin note{" "}
              <span className="text-muted-foreground font-normal">
                (optional, for audit log)
              </span>
            </p>
            <Textarea
              placeholder="Reason for this action…"
              rows={3}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="resize-none text-sm"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant={
                confirmAction && ACTION_META[confirmAction].destructive
                  ? "destructive"
                  : "default"
              }
              disabled={isSubmitting}
              onClick={handleConfirmedAction}
            >
              {isSubmitting
                ? "Processing…"
                : confirmAction
                  ? ACTION_META[confirmAction].confirmLabel
                  : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
