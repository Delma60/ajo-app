"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  SearchIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ReceiptTextIcon,
  UsersIcon,
  CircleDollarSignIcon,
  GiftIcon,
  ShieldAlertIcon,
  ChevronRightIcon,
  FilterIcon,
  XIcon,
  CopyIcon,
  CheckIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ExternalLinkIcon,
  CalendarIcon,
  AlertTriangleIcon,
  WalletIcon,
  RotateCcwIcon,
  InfoIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminTransaction {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  circleId: string | null;
  type: string;
  direction: "credit" | "debit";
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
  provider: string | null;
  providerReference: string | null;
  reference: string;
  description: string;
  meta: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface Stats {
  totalVolume: number;
  totalCount: number;
  successCount: number;
  pendingCount: number;
  failedCount: number;
  creditVolume: number;
  debitVolume: number;
}

// ─── Wallet impact helper ─────────────────────────────────────────────────────

/**
 * Determines what wallet side-effect will occur when admin changes status.
 * Must mirror the logic in app/api/admin/transactions/[id]/route.ts.
 */
function getWalletImpact(
  tx: AdminTransaction,
  newStatus: string,
): {
  action: "refund" | "credit" | null;
  label: string;
  description: string;
  severity: "warning" | "info" | null;
} {
  const isSuccessfulDebit = tx.status === "success" && tx.direction === "debit";
  const isBeingReversed = newStatus === "failed" || newStatus === "cancelled";

  if (isSuccessfulDebit && isBeingReversed) {
    return {
      action: "refund",
      label: "Wallet Refund",
      description: `₦${(tx.amount / 100).toLocaleString("en-NG")} will be credited back to ${tx.userName}'s wallet.`,
      severity: "warning",
    };
  }

  const isFailedOrPendingCredit =
    (tx.status === "failed" || tx.status === "pending") &&
    tx.direction === "credit" &&
    tx.type === "deposit";

  if (isFailedOrPendingCredit && newStatus === "success") {
    return {
      action: "credit",
      label: "Manual Wallet Credit",
      description: `₦${(tx.amount / 100).toLocaleString("en-NG")} will be credited to ${tx.userName}'s wallet immediately.`,
      severity: "warning",
    };
  }

  return {
    action: null,
    label: "No Wallet Change",
    description:
      "This status change will not affect the user's wallet balance.",
    severity: "info",
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<
  string,
  { label: string; icon: React.ElementType; iconBg: string; iconColor: string }
> = {
  deposit: {
    label: "Deposit",
    icon: ArrowDownLeftIcon,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  withdrawal: {
    label: "Withdrawal",
    icon: ArrowUpRightIcon,
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  contribution: {
    label: "Contribution",
    icon: UsersIcon,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  payout: {
    label: "Payout",
    icon: CircleDollarSignIcon,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  penalty: {
    label: "Penalty",
    icon: ShieldAlertIcon,
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
  },
  referral_bonus: {
    label: "Referral Bonus",
    icon: GiftIcon,
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  creation_fee: {
    label: "Creation Fee",
    icon: ReceiptTextIcon,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
  },
};

const STATUS_META: Record<
  string,
  { label: string; cls: string; icon: React.ElementType }
> = {
  success: {
    label: "Success",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: CheckCircle2Icon,
  },
  pending: {
    label: "Pending",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: ClockIcon,
  },
  failed: {
    label: "Failed",
    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: XCircleIcon,
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-muted text-muted-foreground",
    icon: XCircleIcon,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

function fmtNairaFull(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(kobo / 100);
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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
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
      className="ml-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? (
        <CheckIcon className="size-3 text-emerald-500" />
      ) : (
        <CopyIcon className="size-3" />
      )}
    </button>
  );
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({
  stats,
  isLoading,
}: {
  stats: Stats | null;
  isLoading: boolean;
}) {
  const items = [
    {
      label: "Total volume",
      value: fmtNaira(stats?.totalVolume ?? 0),
      icon: ReceiptTextIcon,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      label: "Credits",
      value: fmtNaira(stats?.creditVolume ?? 0),
      icon: TrendingUpIcon,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Debits",
      value: fmtNaira(stats?.debitVolume ?? 0),
      icon: TrendingDownIcon,
      iconBg: "bg-orange-100 dark:bg-orange-900/30",
      iconColor: "text-orange-600 dark:text-orange-400",
    },
    {
      label: "Pending",
      value: (stats?.pendingCount ?? 0).toLocaleString(),
      icon: ClockIcon,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Failed",
      value: (stats?.failedCount ?? 0).toLocaleString(),
      icon: XCircleIcon,
      iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-start justify-between gap-3 py-3">
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              {isLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <p className="text-lg font-bold font-mono leading-none">
                  {item.value}
                </p>
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
      ))}
    </div>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TransactionRow({
  tx,
  onOpenDetail,
}: {
  tx: AdminTransaction;
  onOpenDetail: (tx: AdminTransaction) => void;
}) {
  const typeMeta = TYPE_META[tx.type] ?? {
    label: tx.type,
    icon: ReceiptTextIcon,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
  };
  const statusMeta = STATUS_META[tx.status] ?? STATUS_META.pending;
  const StatusIcon = statusMeta.icon;

  const initials = tx.userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group"
      onClick={() => onOpenDetail(tx)}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          typeMeta.iconBg,
        )}
      >
        <typeMeta.icon className={cn("size-4", typeMeta.iconColor)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate leading-tight">
          {tx.description}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">
          {tx.reference}
        </p>
      </div>

      <div className="hidden md:flex items-center gap-2 shrink-0 w-40">
        <Avatar className="size-6 shrink-0">
          <AvatarImage src={tx.userAvatarUrl ?? undefined} />
          <AvatarFallback className="text-[9px] font-semibold bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{tx.userName}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {tx.userEmail}
          </p>
        </div>
      </div>

      <div className="hidden lg:block shrink-0">
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
          {typeMeta.label}
        </span>
      </div>

      <div className="hidden sm:flex shrink-0 items-center gap-1">
        <StatusIcon
          className={cn(
            "size-3.5",
            tx.status === "success"
              ? "text-emerald-600 dark:text-emerald-400"
              : tx.status === "pending"
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400",
          )}
        />
        <span
          className={cn(
            "text-[10px] font-medium",
            tx.status === "success"
              ? "text-emerald-700 dark:text-emerald-400"
              : tx.status === "pending"
                ? "text-amber-700 dark:text-amber-400"
                : "text-red-700 dark:text-red-400",
          )}
        >
          {statusMeta.label}
        </span>
      </div>

      <p className="hidden xl:block text-xs text-muted-foreground shrink-0 w-28 text-right">
        {fmtDate(tx.createdAt)}
      </p>

      <div className="text-right shrink-0">
        <p
          className={cn(
            "text-sm font-semibold font-mono tabular-nums",
            tx.direction === "credit"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground",
          )}
        >
          {tx.direction === "credit" ? "+" : "−"}
          {fmtNaira(tx.amount)}
        </p>
        {tx.fee > 0 && (
          <p className="text-[10px] text-muted-foreground">
            fee {fmtNaira(tx.fee)}
          </p>
        )}
        <span
          className={cn(
            "inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium sm:hidden",
            tx.status === "success"
              ? "text-emerald-700 dark:text-emerald-400"
              : tx.status === "pending"
                ? "text-amber-700 dark:text-amber-400"
                : "text-red-700 dark:text-red-400",
          )}
        >
          <StatusIcon className="size-3.5" />
          {statusMeta.label}
        </span>
      </div>

      <ChevronRightIcon className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}

// ─── Status Update Confirmation Dialog ───────────────────────────────────────

function StatusUpdateConfirmDialog({
  open,
  onOpenChange,
  tx,
  newStatus,
  onConfirm,
  isUpdating,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tx: AdminTransaction;
  newStatus: string;
  onConfirm: () => void;
  isUpdating: boolean;
}) {
  if (!tx) return null;

  const impact = getWalletImpact(tx, newStatus);
  const newStatusMeta = STATUS_META[newStatus] ?? STATUS_META.pending;
  const StatusIcon = newStatusMeta.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-4 text-amber-500" />
            Confirm Status Change
          </DialogTitle>
          <DialogDescription>
            You're about to update the status of transaction{" "}
            <span className="font-mono font-medium text-foreground">
              {tx.reference}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Status transition */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">
                Current status
              </p>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  STATUS_META[tx.status]?.cls ??
                    "bg-muted text-muted-foreground",
                )}
              >
                {tx.status}
              </span>
            </div>
            <ChevronRightIcon className="size-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1">New status</p>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  newStatusMeta.cls,
                )}
              >
                <StatusIcon className="size-3" />
                {newStatus}
              </span>
            </div>
          </div>

          {/* Wallet impact */}
          <div
            className={cn(
              "rounded-lg border px-4 py-3 space-y-1.5",
              impact.action === "refund" || impact.action === "credit"
                ? "border-amber-200 bg-amber-50 dark:border-amber-800/30 dark:bg-amber-900/10"
                : "border-border bg-muted/20",
            )}
          >
            <div className="flex items-center gap-2">
              <WalletIcon
                className={cn(
                  "size-3.5 shrink-0",
                  impact.action
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground",
                )}
              />
              <p
                className={cn(
                  "text-xs font-semibold",
                  impact.action
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground",
                )}
              >
                {impact.label}
              </p>
            </div>
            <p
              className={cn(
                "text-xs leading-relaxed",
                impact.action
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-muted-foreground",
              )}
            >
              {impact.description}
            </p>
            {impact.action === "refund" && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ This cannot be automatically reversed.
              </p>
            )}
            {impact.action === "credit" && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ Only do this if you have confirmed the payment with the
                provider.
              </p>
            )}
          </div>

          {/* Transaction summary */}
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">User</span>
              <span className="font-medium">{tx.userName}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono font-semibold">
                {tx.direction === "credit" ? "+" : "−"}
                {fmtNaira(tx.amount)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">
                {tx.type.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isUpdating}
            className={cn(
              impact.action ? "bg-amber-600 hover:bg-amber-700 text-white" : "",
            )}
          >
            {isUpdating ? (
              <>
                <RefreshCwIcon className="size-3.5 mr-1.5 animate-spin" />
                Updating…
              </>
            ) : (
              <>
                {impact.action === "refund" && (
                  <RotateCcwIcon className="size-3.5 mr-1.5" />
                )}
                {impact.action === "credit" && (
                  <WalletIcon className="size-3.5 mr-1.5" />
                )}
                Confirm
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

function TransactionDetailSheet({
  tx,
  open,
  onOpenChange,
  onStatusChange,
}: {
  tx: AdminTransaction | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStatusChange?: (status: string, walletAffected: boolean) => void;
}) {
  const [pendingStatus, setPendingStatus] = useState(tx?.status ?? "pending");
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setPendingStatus(tx?.status ?? "pending");
  }, [tx]);

  if (!tx) return null;

  const typeMeta = TYPE_META[tx.type] ?? {
    label: tx.type,
    icon: ReceiptTextIcon,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
  };
  const currentStatusMeta = STATUS_META[tx.status] ?? STATUS_META.pending;
  const impact = getWalletImpact(tx, pendingStatus);

  const initials = tx.userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function InfoRow({
    label,
    value,
    mono,
    copyable,
    valueClassName,
  }: {
    label: string;
    value: string;
    mono?: boolean;
    copyable?: boolean;
    valueClassName?: string;
  }) {
    return (
      <div className="flex items-start justify-between gap-4 py-2.5 border-b border-border last:border-0">
        <p className="text-xs text-muted-foreground shrink-0 w-32">{label}</p>
        <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
          <p
            className={cn(
              "text-xs text-right truncate",
              mono && "font-mono font-medium",
              valueClassName,
            )}
          >
            {value || "—"}
          </p>
          {copyable && value && <CopyButton value={value} />}
        </div>
      </div>
    );
  }

  async function handleConfirmedUpdate() {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/transactions/${tx?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: pendingStatus }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to update");

      const { walletAffected, walletAction } = json.data ?? {};

      if (walletAction === "refund") {
        toast.success(
          `Status updated. ₦${(tx!.amount / 100).toLocaleString("en-NG")} refunded to ${tx!.userName}'s wallet.`,
        );
      } else if (walletAction === "credit") {
        toast.success(
          `Deposit approved. ₦${(tx!.amount / 100).toLocaleString("en-NG")} credited to ${tx!.userName}'s wallet.`,
        );
      } else {
        toast.success("Transaction status updated.");
      }

      setConfirmOpen(false);
      if (onStatusChange)
        onStatusChange(pendingStatus, walletAffected ?? false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  }

  const hasStatusChange = pendingStatus !== tx.status;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col p-0 gap-0"
        >
          {/* Header */}
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-2xl",
                  typeMeta.iconBg,
                )}
              >
                <typeMeta.icon className={cn("size-5", typeMeta.iconColor)} />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base font-semibold leading-tight">
                  {typeMeta.label}
                </SheetTitle>
                <SheetDescription className="text-xs mt-0.5 line-clamp-2">
                  {tx.description}
                </SheetDescription>
                <div className="flex items-center gap-1.5 mt-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      currentStatusMeta.cls,
                    )}
                  >
                    <currentStatusMeta.icon className="size-3" />
                    {currentStatusMeta.label}
                  </span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                    {tx.direction === "credit" ? "Credit" : "Debit"}
                  </span>
                </div>
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* ── Status Update Panel ── */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">
                Update Status
              </p>

              <Select value={pendingStatus} onValueChange={setPendingStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Wallet impact preview */}
              {hasStatusChange && (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2.5 flex items-start gap-2.5",
                    impact.action
                      ? "border-amber-200 bg-amber-50 dark:border-amber-800/30 dark:bg-amber-900/10"
                      : "border-border bg-background",
                  )}
                >
                  {impact.action ? (
                    <WalletIcon className="size-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <InfoIcon className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        impact.action
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-muted-foreground",
                      )}
                    >
                      {impact.label}
                    </p>
                    <p
                      className={cn(
                        "text-xs mt-0.5 leading-relaxed",
                        impact.action
                          ? "text-amber-700/80 dark:text-amber-300/80"
                          : "text-muted-foreground",
                      )}
                    >
                      {impact.description}
                    </p>
                  </div>
                </div>
              )}

              <Button
                size="sm"
                className="w-full gap-1.5"
                disabled={!hasStatusChange || isUpdating}
                onClick={() => setConfirmOpen(true)}
              >
                {impact.action === "refund" && (
                  <RotateCcwIcon className="size-3.5" />
                )}
                {impact.action === "credit" && (
                  <WalletIcon className="size-3.5" />
                )}
                {!impact.action && <CheckIcon className="size-3.5" />}
                {hasStatusChange
                  ? impact.action
                    ? `Update & ${impact.action === "refund" ? "Refund Wallet" : "Credit Wallet"}`
                    : "Update Status"
                  : "No Changes"}
              </Button>
            </div>

            {/* Amount card */}
            <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-4 space-y-3">
              <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                Amount
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    Gross
                  </p>
                  <p
                    className={cn(
                      "text-xl font-black font-mono leading-none",
                      tx.direction === "credit"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-foreground",
                    )}
                  >
                    {tx.direction === "credit" ? "+" : "−"}
                    {fmtNairaFull(tx.amount)}
                  </p>
                </div>
                {tx.fee > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      Fee
                    </p>
                    <p className="text-sm font-semibold font-mono text-muted-foreground">
                      −{fmtNairaFull(tx.fee)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">
                    Net
                  </p>
                  <p className="text-sm font-semibold font-mono">
                    {fmtNairaFull(tx.netAmount)}
                  </p>
                </div>
              </div>
            </div>

            {/* User */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                User
              </p>
              <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                <Avatar className="size-10 shrink-0">
                  <AvatarImage src={tx.userAvatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.userName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {tx.userEmail}
                  </p>
                </div>
                <CopyButton value={tx.userId} />
              </div>
            </div>

            {/* Transaction details */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Transaction Details
              </p>
              <div className="rounded-xl border border-border overflow-hidden">
                <InfoRow label="Reference" value={tx.reference} mono copyable />
                {tx.providerReference && (
                  <InfoRow
                    label="Provider Ref"
                    value={tx.providerReference}
                    mono
                    copyable
                  />
                )}
                <InfoRow label="Transaction ID" value={tx.id} mono copyable />
                {tx.circleId && (
                  <InfoRow
                    label="Circle ID"
                    value={tx.circleId}
                    mono
                    copyable
                  />
                )}
                {tx.provider && (
                  <InfoRow label="Provider" value={tx.provider} />
                )}
                <InfoRow label="Type" value={typeMeta.label} />
                <InfoRow
                  label="Direction"
                  value={
                    tx.direction === "credit"
                      ? "Credit (incoming)"
                      : "Debit (outgoing)"
                  }
                />
                <InfoRow label="Created" value={fmtDateTime(tx.createdAt)} />
                <InfoRow label="Updated" value={fmtDateTime(tx.updatedAt)} />
              </div>
            </div>

            {/* Meta */}
            {tx.meta && Object.keys(tx.meta).length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Metadata
                </p>
                <div className="rounded-xl border border-border bg-muted/30 p-3 overflow-auto max-h-36">
                  <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
                    {JSON.stringify(tx.meta, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Quick links */}
            {tx.circleId && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Quick Links
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 justify-start"
                  asChild
                >
                  <a
                    href={`/circles/${tx.circleId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                    View Circle
                  </a>
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation dialog */}
      <StatusUpdateConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tx={tx}
        newStatus={pendingStatus}
        onConfirm={handleConfirmedUpdate}
        isUpdating={isUpdating}
      />
    </>
  );
}

// ─── Filters bar ──────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  type: string;
  status: string;
  direction: string;
  dateFrom: string;
  dateTo: string;
}

function FiltersBar({
  filters,
  onChange,
  activeCount,
  onClear,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  activeCount: number;
  onClear: () => void;
}) {
  function update(partial: Partial<Filters>) {
    onChange({ ...filters, ...partial });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by reference, user, or description…"
            className="pl-8"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>

        <Select value={filters.type} onValueChange={(v) => update({ type: v })}>
          <SelectTrigger className="w-full sm:w-[155px]">
            <FilterIcon className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="deposit">Deposit</SelectItem>
            <SelectItem value="withdrawal">Withdrawal</SelectItem>
            <SelectItem value="contribution">Contribution</SelectItem>
            <SelectItem value="payout">Payout</SelectItem>
            <SelectItem value="penalty">Penalty</SelectItem>
            <SelectItem value="referral_bonus">Referral Bonus</SelectItem>
            <SelectItem value="creation_fee">Creation Fee</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(v) => update({ status: v })}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.direction}
          onValueChange={(v) => update({ direction: v })}
        >
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="All directions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All directions</SelectItem>
            <SelectItem value="credit">Credits</SelectItem>
            <SelectItem value="debit">Debits</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-center">
        <div className="flex items-center gap-2 flex-1">
          <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
          <Input
            type="date"
            className="h-8 text-xs flex-1"
            value={filters.dateFrom}
            onChange={(e) => update({ dateFrom: e.target.value })}
          />
          <span className="text-xs text-muted-foreground shrink-0">to</span>
          <Input
            type="date"
            className="h-8 text-xs flex-1"
            value={filters.dateTo}
            onChange={(e) => update({ dateTo: e.target.value })}
          />
        </div>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground shrink-0"
            onClick={onClear}
          >
            <XIcon className="size-3.5" />
            Clear filters ({activeCount})
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Row skeleton ─────────────────────────────────────────────────────────────

function TransactionRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
      <Skeleton className="size-9 rounded-xl shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-56" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="hidden md:flex items-center gap-2 w-40 shrink-0">
        <Skeleton className="size-6 rounded-full shrink-0" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-32" />
        </div>
      </div>
      <Skeleton className="hidden lg:block h-5 w-20 rounded-full" />
      <Skeleton className="hidden sm:block h-4 w-16" />
      <Skeleton className="hidden xl:block h-3 w-20" />
      <div className="text-right space-y-1 shrink-0">
        <Skeleton className="h-4 w-20 ml-auto" />
      </div>
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = {
  search: "",
  type: "all",
  status: "all",
  direction: "all",
  dateFrom: "",
  dateTo: "",
};

export function AdminTransactionsContent() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [detailTx, setDetailTx] = useState<AdminTransaction | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTransactions = useCallback(
    async (cursor: string | null = null, reset = true) => {
      reset ? setIsLoading(true) : setIsLoadingMore(true);
      setHasError(false);

      try {
        const params = new URLSearchParams({ limit: "30" });
        if (filters.type !== "all") params.set("type", filters.type);
        if (filters.status !== "all") params.set("status", filters.status);
        if (filters.direction !== "all")
          params.set("direction", filters.direction);
        if (filters.search.trim()) params.set("search", filters.search.trim());
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/admin/transactions?${params}`);
        const json = await res.json();

        if (!json.success) throw new Error(json.error ?? "Failed to load");

        setTransactions((prev) =>
          reset ? json.data : [...prev, ...json.data],
        );
        setHasMore(json.meta?.hasMore ?? false);
        setNextCursor(json.meta?.nextCursor ?? null);
        if (reset && json.meta?.stats) setStats(json.meta.stats);
      } catch (err) {
        setHasError(true);
        toast.error(
          err instanceof Error ? err.message : "Failed to load transactions",
        );
      } finally {
        reset ? setIsLoading(false) : setIsLoadingMore(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const delay = filters.search ? 400 : 0;
    searchTimerRef.current = setTimeout(() => {
      fetchTransactions(null, true);
    }, delay);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [filters, fetchTransactions]);

  const activeFilterCount = [
    filters.type !== "all",
    filters.status !== "all",
    filters.direction !== "all",
    !!filters.dateFrom,
    !!filters.dateTo,
  ].filter(Boolean).length;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Transactions</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor all financial activity across the platform.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTransactions(null, true)}
            className="gap-1.5 self-start sm:self-auto"
            disabled={isLoading}
          >
            <RefreshCwIcon
              className={cn("size-3.5", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>

        <StatsStrip stats={stats} isLoading={isLoading} />

        <FiltersBar
          filters={filters}
          onChange={(f) => setFilters(f)}
          activeCount={activeFilterCount}
          onClear={() => setFilters(DEFAULT_FILTERS)}
        />

        {!isLoading && !hasError && (
          <p className="text-xs text-muted-foreground">
            {transactions.length} transaction
            {transactions.length !== 1 ? "s" : ""}
            {hasMore ? "+" : ""} found
          </p>
        )}

        <Card>
          <CardHeader className="border-b py-3 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm text-muted-foreground font-normal">
                {isLoading
                  ? "Loading…"
                  : `${transactions.length} result${transactions.length !== 1 ? "s" : ""}${hasMore ? "+" : ""}`}
              </CardTitle>
              <div className="hidden xl:flex items-center gap-1 text-xs text-muted-foreground pr-8 space-x-4">
                <span className="w-40">User</span>
                <span className="w-20 text-center">Type</span>
                <span className="w-20 text-center">Status</span>
                <span className="w-28 text-right">Date</span>
                <span className="w-24 text-right">Amount</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TransactionRowSkeleton key={i} />
                ))}
              </div>
            ) : hasError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircleIcon className="size-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Failed to load transactions
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check your connection and try again.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchTransactions(null, true)}
                  className="gap-1.5"
                >
                  <RefreshCwIcon className="size-3.5" />
                  Retry
                </Button>
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <ReceiptTextIcon className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No transactions found</p>
                <p className="text-xs text-muted-foreground">
                  {activeFilterCount > 0 || filters.search
                    ? "Try adjusting your filters."
                    : "No transactions have been recorded yet."}
                </p>
              </div>
            ) : (
              <div>
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    onOpenDetail={setDetailTx}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {hasMore && !isLoading && !hasError && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {transactions.length} transaction
              {transactions.length !== 1 ? "s" : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoadingMore}
              onClick={() => fetchTransactions(nextCursor, false)}
              className="gap-1.5"
            >
              {isLoadingMore ? (
                <RefreshCwIcon className="size-3.5 animate-spin" />
              ) : (
                <ChevronRightIcon className="size-3.5" />
              )}
              {isLoadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>

      <TransactionDetailSheet
        tx={detailTx}
        open={!!detailTx}
        onOpenChange={(open) => !open && setDetailTx(null)}
        onStatusChange={(newStatus, walletAffected) => {
          if (!detailTx) return;
          // Update the tx in the list
          setTransactions((prev) =>
            prev.map((t) =>
              t.id === detailTx.id ? { ...t, status: newStatus } : t,
            ),
          );
          // Update the open detail view
          setDetailTx((prev) => (prev ? { ...prev, status: newStatus } : null));
          router.refresh();
        }}
      />
    </div>
  );
}
