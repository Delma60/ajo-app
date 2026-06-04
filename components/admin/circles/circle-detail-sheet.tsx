"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ExternalLinkIcon,
  UsersIcon,
  PauseIcon,
  PlayIcon,
  XCircleIcon,
  ShieldCheckIcon,
  CalendarIcon,
  TagIcon,
  KeyIcon,
  TrendingUpIcon,
  CircleDollarSignIcon,
  ClockIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  XIcon,
  CopyIcon,
  CheckIcon,
  ArrowUpIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  AdminCircle,
  STATUS_META,
  FREQ_LABELS,
  PAYOUT_LABELS,
  TRUST_TIER,
} from "@/lib/types/admin-circle";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CircleDetail extends AdminCircle {
  adminName: string;
  adminEmail: string;
  members: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    isAdmin: boolean;
    isPendingPayout: boolean;
    isPaused: boolean;
  }[];
  recentContributions: {
    id: string;
    userId: string;
    userName: string;
    cycle: number;
    amount: number;
    status: "pending" | "paid" | "late" | "missed";
    dueDate: string | null;
    paidAt: string | null;
    penaltyAmount: number | null;
  }[];
}

interface CircleDetailSheetProps {
  circle: AdminCircle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (id: string, action: "pause" | "unpause" | "cancel") => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const CONTRIB_STATUS_META = {
  paid: {
    label: "Paid",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: CheckCircle2Icon,
  },
  pending: {
    label: "Pending",
    cls: "bg-muted text-muted-foreground",
    icon: ClockIcon,
  },
  late: {
    label: "Late",
    cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    icon: AlertTriangleIcon,
  },
  missed: {
    label: "Missed",
    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: XIcon,
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

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
            valueClassName
          )}
        >
          {value || "—"}
        </p>
      </div>
      {copyable && value && (
        <button
          onClick={handleCopy}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-emerald-500" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

function TrustScoreCard({
  score,
  breakdown,
}: {
  score: number;
  breakdown: CircleDetail["trustScoreBreakdown"];
}) {
  const tier = TRUST_TIER(score);
  const bgMap: Record<string, string> = {
    Excellent: "from-emerald-50 to-emerald-100/50 border-emerald-200 dark:from-emerald-950/30 dark:to-emerald-900/20 dark:border-emerald-800/30",
    Good: "from-blue-50 to-blue-100/50 border-blue-200 dark:from-blue-950/30 dark:to-blue-900/20 dark:border-blue-800/30",
    Fair: "from-amber-50 to-amber-100/50 border-amber-200 dark:from-amber-950/30 dark:to-amber-900/20 dark:border-amber-800/30",
    Low: "from-orange-50 to-orange-100/50 border-orange-200 dark:from-orange-950/30 dark:to-orange-900/20 dark:border-orange-800/30",
    "At Risk": "from-red-50 to-red-100/50 border-red-200 dark:from-red-950/30 dark:to-red-900/20 dark:border-red-800/30",
  };

  return (
    <div
      className={cn(
        "rounded-xl bg-gradient-to-br border p-4 space-y-3",
        bgMap[tier.label] ?? bgMap["Fair"]
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Trust Score
          </p>
        </div>
        <span className={cn("text-xs font-bold", tier.cls)}>
          {tier.label}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-end justify-between">
          <p className={cn("text-3xl font-black font-mono leading-none", tier.cls)}>
            {score}
            <span className="text-base font-normal text-muted-foreground">/100</span>
          </p>
        </div>
        <Progress
          value={score}
          className={cn("h-2", tier.barCls)}
        />
      </div>

      {breakdown && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="text-center">
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {breakdown.onTimePayments}
            </p>
            <p className="text-[10px] text-muted-foreground">On-time</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-orange-600 dark:text-orange-400 font-mono">
              {breakdown.latePayments}
            </p>
            <p className="text-[10px] text-muted-foreground">Late</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-red-600 dark:text-red-400 font-mono">
              {breakdown.missedPayments}
            </p>
            <p className="text-[10px] text-muted-foreground">Missed</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  onPause,
  onResume,
  onShift,
  disabled,
}: {
  member: CircleDetail["members"][0];
  onPause: (memberId: string) => void;
  onResume: (memberId: string) => void;
  onShift: (memberId: string) => void;
  disabled: boolean;
}) {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium text-foreground truncate leading-tight">
            {member.name}
          </p>
          {member.isAdmin && (
            <Badge variant="secondary" className="text-[9px] h-3.5 px-1 shrink-0">
              Admin
            </Badge>
          )}
          {member.isPendingPayout && (
            <Badge className="text-[9px] h-3.5 px-1 shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Next payout
            </Badge>
          )}
          {member.isPaused && (
            <Badge className="text-[9px] h-3.5 px-1 shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Paused
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">{member.email}</p>
      </div>
      <div className="flex flex-wrap gap-1 items-center">
        {!member.isAdmin && (
          <>
            <Button
              variant={member.isPaused ? "secondary" : "outline"}
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => (member.isPaused ? onResume(member.id) : onPause(member.id))}
              disabled={disabled}
            >
              {member.isPaused ? <PlayIcon className="size-4" /> : <PauseIcon className="size-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => onShift(member.id)}
              disabled={disabled}
              title="Prioritize payout"
            >
              <ArrowUpIcon className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ContributionRow({
  contrib,
}: {
  contrib: CircleDetail["recentContributions"][0];
}) {
  const meta = CONTRIB_STATUS_META[contrib.status];
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg",
          contrib.status === "paid"
            ? "bg-emerald-100 dark:bg-emerald-900/30"
            : contrib.status === "late"
            ? "bg-orange-100 dark:bg-orange-900/30"
            : contrib.status === "missed"
            ? "bg-red-100 dark:bg-red-900/30"
            : "bg-muted"
        )}
      >
        <Icon
          className={cn(
            "size-3.5",
            contrib.status === "paid"
              ? "text-emerald-600 dark:text-emerald-400"
              : contrib.status === "late"
              ? "text-orange-600 dark:text-orange-400"
              : contrib.status === "missed"
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground"
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium text-foreground truncate leading-tight">
            {contrib.userName}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">
            Cycle {contrib.cycle}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {contrib.status === "paid"
            ? `Paid ${fmtDateTime(contrib.paidAt)}`
            : `Due ${fmtDate(contrib.dueDate)}`}
          {contrib.penaltyAmount && contrib.penaltyAmount > 0
            ? ` · +${fmtNaira(contrib.penaltyAmount)} penalty`
            : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold font-mono">
          {fmtNaira(contrib.amount)}
        </p>
        <span
          className={cn(
            "text-[9px] font-medium px-1.5 py-0.5 rounded-full",
            meta.cls
          )}
        >
          {meta.label}
        </span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5 p-1">
      <Skeleton className="h-28 rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="size-7 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-3.5 w-36" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-20 rounded-xl" />
    </div>
  );
}

function Section({
  title,
  count,
  children,
  empty,
  emptyLabel,
}: {
  title: string;
  count?: number;
  children?: React.ReactNode;
  empty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        {count !== undefined && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {count}
          </Badge>
        )}
      </div>
      {empty ? (
        <p className="text-xs text-muted-foreground py-3 text-center">
          {emptyLabel ?? "None found"}
        </p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

export function CircleDetailSheet({
  circle,
  open,
  onOpenChange,
  onAction,
}: CircleDetailSheetProps) {
  const [detail, setDetail] = useState<CircleDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "pause" | "unpause" | "cancel" | null
  >(null);
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);
  const [invitePermission, setInvitePermission] = useState<
    CircleDetail["invitePermission"]
  >(circle?.invitePermission ?? "admin");
  const [isUpdatingInvitePermission, setIsUpdatingInvitePermission] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !circle) return;
    setDetail(null);
    setHasError(false);
    setIsLoading(true);
    setInvitePermission(circle.invitePermission ?? "admin");
    loadDetail(circle.id);
  }, [open, circle?.id]);

  useEffect(() => {
    if (detail) {
      setInvitePermission(detail.invitePermission ?? "admin");
    }
  }, [detail?.invitePermission]);

  async function loadDetail(id: string) {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/circles/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load");
      setDetail(json.data as CircleDetail);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }

  if (!circle) return null;

  const current = detail ?? circle;
  const statusMeta = STATUS_META[current.status];
  const tier = TRUST_TIER(current.trustScore);

  async function handleConfirmedAction() {
    if (!confirmAction || !circle) return;
    setIsSubmitting(true);
    try {
      await onAction(circle.id, confirmAction);
      // Reload detail after successful action
      await loadDetail(circle.id);
      setConfirmAction(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onMemberAction(memberId: string, action: "pause" | "resume" | "shift") {
    if (!circle) return;
    setMemberActionLoading(memberId);
    try {
      const response = await fetch(`/api/circles/${circle.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, memberId }),
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to perform member action.");
      }
      toast.success(
        action === "shift"
          ? "Member payout priority updated."
          : action === "pause"
          ? "Member paused successfully."
          : "Member resumed successfully."
      );
      await loadDetail(circle.id);
    } catch (error) {
      toast.error((error as Error).message || "Member action failed.");
    } finally {
      setMemberActionLoading(null);
    }
  }

  async function handleInvitePermissionChange(
    value: CircleDetail["invitePermission"],
  ) {
    if (!circle || value === invitePermission) return;
    setIsUpdatingInvitePermission(true);
    try {
      const response = await fetch(`/api/circles/${circle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitePermission: value }),
      });
      const json = await response.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to update invite permissions.");
      }
      setInvitePermission(value);
      toast.success("Invite permissions updated.");
      await loadDetail(circle.id);
    } catch (error) {
      toast.error((error as Error).message || "Failed to update invite permissions.");
    } finally {
      setIsUpdatingInvitePermission(false);
    }
  }

  const ACTION_META = {
    pause: {
      label: "Pause Circle",
      description:
        "Pausing freezes all due dates and payout dates. Members will be notified. Only the admin can unpause.",
      destructive: true,
    },
    unpause: {
      label: "Resume Circle",
      description:
        "Resuming restarts the circle. Due dates will be recalculated from today. Members will be notified.",
      destructive: false,
    },
    cancel: {
      label: "Cancel Circle",
      description:
        "This will permanently cancel the circle and cancel all pending contributions. This action cannot be undone.",
      destructive: true,
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
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-base font-semibold leading-tight truncate">
                      {current.name}
                    </SheetTitle>
                    <SheetDescription className="text-xs mt-0.5 line-clamp-2">
                      {current.description || "No description provided"}
                    </SheetDescription>
                  </div>
                  <Link
                    href={`/circles/${circle.id}`}
                    target="_blank"
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                  >
                    <ExternalLinkIcon className="size-4" />
                  </Link>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      statusMeta.cls
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        statusMeta.dotCls
                      )}
                    />
                    {statusMeta.label}
                  </span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                    {PAYOUT_LABELS[current.payoutOrder]}
                  </span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                    {FREQ_LABELS[current.frequency]}
                  </span>
                  {current.isPrivate && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border border-border text-muted-foreground">
                      Private
                    </span>
                  )}
                  {current.tags.length > 0 &&
                    current.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {isLoading && !detail ? (
              <LoadingSkeleton />
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
                  onClick={() => loadDetail(circle.id)}
                >
                  <RefreshCwIcon className="size-3.5" />
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {/* Trust Score */}
                <TrustScoreCard
                  score={current.trustScore}
                  breakdown={detail?.trustScoreBreakdown ?? current.trustScoreBreakdown}
                />

                {/* Progress snapshot */}
                <div className="rounded-xl border border-border p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Circle Progress
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">
                        Member fill
                      </p>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={current.fillPercent}
                          className="h-1.5 flex-1 [&>[data-slot=progress-indicator]]:bg-blue-500"
                        />
                        <span className="text-xs font-mono font-semibold shrink-0">
                          {current.memberCount}/{current.maxMembers}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">
                        Cycles
                      </p>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.round(
                            (current.currentCycle / current.totalCycles) * 100
                          )}
                          className="h-1.5 flex-1 [&>[data-slot=progress-indicator]]:bg-primary"
                        />
                        <span className="text-xs font-mono font-semibold shrink-0">
                          {current.currentCycle}/{current.totalCycles}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Contribution</p>
                      <p className="text-sm font-semibold font-mono">
                        {fmtNaira(current.contribution)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Pool size</p>
                      <p className="text-sm font-semibold font-mono">
                        {fmtNaira(current.goal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Saved</p>
                      <p className="text-sm font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                        {fmtNaira(current.saved)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Circle info */}
                <Section title="Circle Details">
                  <InfoRow
                    icon={CalendarIcon}
                    label="Next due date"
                    value={fmtDate(current.nextDueDate)}
                  />
                  <InfoRow
                    icon={CircleDollarSignIcon}
                    label="Next payout"
                    value={fmtDate(current.nextPayoutDate)}
                  />
                  <InfoRow
                    icon={CalendarIcon}
                    label="Created"
                    value={fmtDate(current.createdAt)}
                  />
                  <InfoRow
                    icon={KeyIcon}
                    label="Invite code"
                    value={current.inviteCode}
                    mono
                    copyable
                  />
                  <InfoRow
                    icon={ShieldCheckIcon}
                    label="Invite permissions"
                    value={
                      (current.invitePermission === "members"
                        ? "Members can invite"
                        : "Admin only")
                    }
                    valueClassName={
                      current.invitePermission === "members"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                    }
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <Button
                      type="button"
                      variant={
                        invitePermission === "admin" ? "secondary" : "outline"
                      }
                      className="w-full"
                      onClick={() => handleInvitePermissionChange("admin")}
                      disabled={isUpdatingInvitePermission}
                    >
                      Admin only
                    </Button>
                    <Button
                      type="button"
                      variant={
                        invitePermission === "members" ? "secondary" : "outline"
                      }
                      className="w-full"
                      onClick={() => handleInvitePermissionChange("members")}
                      disabled={isUpdatingInvitePermission}
                    >
                      Members can invite
                    </Button>
                  </div>
                  {detail && (
                    <InfoRow
                      icon={UsersIcon}
                      label="Admin"
                      value={`${detail.adminName} (${detail.adminEmail})`}
                    />
                  )}
                  {(current.pendingRequestIds?.length ?? 0) > 0 && (
                    <InfoRow
                      icon={ClockIcon}
                      label="Pending join requests"
                      value={`${current.pendingRequestIds.length} pending`}
                      valueClassName="text-amber-600 dark:text-amber-400"
                    />
                  )}
                </Section>

                {/* Members */}
                <Section
                  title="Members"
                  count={detail?.members.length ?? current.memberCount}
                  empty={!detail || detail.members.length === 0}
                  emptyLabel="No members yet"
                >
                  {detail?.members.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      onPause={(memberId) => onMemberAction(memberId, "pause")}
                      onResume={(memberId) => onMemberAction(memberId, "resume")}
                      onShift={(memberId) => onMemberAction(memberId, "shift")}
                      disabled={memberActionLoading !== null}
                    />
                  ))}
                </Section>

                {/* Recent contributions */}
                <Section
                  title="Recent Contributions"
                  count={detail?.recentContributions.length ?? 0}
                  empty={!detail || detail.recentContributions.length === 0}
                  emptyLabel="No contributions yet"
                >
                  {detail?.recentContributions.map((c) => (
                    <ContributionRow key={c.id} contrib={c} />
                  ))}
                </Section>
              </>
            )}
          </div>

          {/* Action footer */}
          {current.status !== "completed" && current.status !== "cancelled" && (
            <div className="shrink-0 border-t border-border px-5 py-4 bg-muted/30 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Admin Actions
              </p>
              <div className="flex gap-2">
                {current.status === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setConfirmAction("pause")}
                  >
                    <PauseIcon className="size-3.5 text-amber-600" />
                    Pause Circle
                  </Button>
                )}
                {current.status === "paused" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setConfirmAction("unpause")}
                  >
                    <PlayIcon className="size-3.5 text-emerald-600" />
                    Resume Circle
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => setConfirmAction("cancel")}
                >
                  <XCircleIcon className="size-3.5" />
                  Cancel Circle
                </Button>
              </div>
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={
                confirmAction && ACTION_META[confirmAction].destructive
                  ? "destructive"
                  : "default"
              }
              disabled={isSubmitting}
              onClick={handleConfirmedAction}
            >
              {isSubmitting ? "Processing…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}