"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheckIcon,
  ShieldOffIcon,
  UserXIcon,
  UserCheckIcon,
  WalletIcon,
  CircleDollarSignIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  UsersIcon,
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  BadgeCheckIcon,
  GiftIcon,
  BuildingIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  AlertCircleIcon,
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
import type { AdminUser } from "@/components/admin/users/content";

// ─── Types ─────────────────────────────────────────────────────────────────

interface UserDetail extends AdminUser {
  wallet: {
    available: number;
    pending: number;
    totalSaved: number;
    totalReceived: number;
    referralEarnings: number;
  } | null;
  recentTransactions: {
    id: string;
    type: string;
    direction: "credit" | "debit";
    amount: number;
    status: string;
    description: string;
    reference: string;
    createdAt: string | null;
  }[];
  activeCircles: {
    id: string;
    name: string;
    status: string;
    contribution: number;
    frequency: string;
    memberCount: number;
    maxMembers: number;
    trustScore: number;
    isAdmin: boolean;
  }[];
}

interface UserDetailSheetProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (id: string, action: string) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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

const STATUS_META = {
  active: {
    label: "Active",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    dotCls: "bg-emerald-500",
  },
  suspended: {
    label: "Suspended",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    dotCls: "bg-amber-500",
  },
  banned: {
    label: "Banned",
    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dotCls: "bg-red-500",
  },
};

const TX_META: Record<
  string,
  { icon: React.ElementType; iconBg: string; iconColor: string }
> = {
  deposit: {
    icon: ArrowDownLeftIcon,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  withdrawal: {
    icon: ArrowUpRightIcon,
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  contribution: {
    icon: UsersIcon,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  payout: {
    icon: CircleDollarSignIcon,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  referral_bonus: {
    icon: GiftIcon,
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
  copyable,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
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
            mono && "font-mono font-medium"
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

function WalletCard({ wallet }: { wallet: UserDetail["wallet"] }) {
  if (!wallet) {
    return (
      <div className="rounded-xl bg-muted/40 border border-border p-4 text-center">
        <p className="text-xs text-muted-foreground">No wallet found</p>
      </div>
    );
  }

  const stats = [
    { label: "Available", value: fmtNaira(wallet.available), highlight: true },
    { label: "Pending", value: fmtNaira(wallet.pending) },
    { label: "Total Saved", value: fmtNaira(wallet.totalSaved) },
    { label: "Total Received", value: fmtNaira(wallet.totalReceived) },
    { label: "Referral Earnings", value: fmtNaira(wallet.referralEarnings) },
  ];

  return (
    <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <WalletIcon className="size-4 text-primary" />
        <p className="text-xs font-semibold text-primary uppercase tracking-wide">
          Wallet
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p
              className={cn(
                "text-sm font-mono font-semibold",
                s.highlight ? "text-primary" : "text-foreground"
              )}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionRow({
  tx,
}: {
  tx: UserDetail["recentTransactions"][0];
}) {
  const meta = TX_META[tx.type] ?? TX_META.deposit;
  const Icon = meta.icon;
  const isCredit = tx.direction === "credit";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          meta.iconBg
        )}
      >
        <Icon className={cn("size-3.5", meta.iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate leading-tight">
          {tx.description}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {fmtDateTime(tx.createdAt)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p
          className={cn(
            "text-xs font-semibold font-mono",
            isCredit
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground"
          )}
        >
          {isCredit ? "+" : "−"}
          {fmtNaira(tx.amount)}
        </p>
        {tx.status !== "success" && (
          <span
            className={cn(
              "text-[9px] font-medium",
              tx.status === "pending"
                ? "text-amber-600"
                : "text-destructive"
            )}
          >
            {tx.status}
          </span>
        )}
      </div>
    </div>
  );
}

function CircleRow({
  circle,
}: {
  circle: UserDetail["activeCircles"][0];
}) {
  const trustColor =
    circle.trustScore >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : circle.trustScore >= 55
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <CircleDollarSignIcon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium text-foreground truncate leading-tight">
            {circle.name}
          </p>
          {circle.isAdmin && (
            <Badge variant="secondary" className="text-[9px] h-3.5 px-1 shrink-0">
              Admin
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          {circle.memberCount}/{circle.maxMembers} members ·{" "}
          {fmtNaira(circle.contribution)}/{circle.frequency}
        </p>
      </div>
      <p className={cn("text-xs font-semibold font-mono shrink-0", trustColor)}>
        {circle.trustScore}/100
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5 p-1">
      {/* Profile */}
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      </div>
      {/* Wallet */}
      <Skeleton className="h-32 rounded-xl" />
      {/* Info rows */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="size-7 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-3.5 w-36" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────────────

function Section({
  title,
  count,
  children,
  empty,
  emptyLabel,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
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
        children
      )}
    </div>
  );
}

// ─── Main sheet ─────────────────────────────────────────────────────────────

export function UserDetailSheet({
  user,
  open,
  onOpenChange,
  onAction,
}: UserDetailSheetProps) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load detail when sheet opens / user changes
  useEffect(() => {
    if (!open || !user) return;

    setDetail(null);
    setError(false);
    setIsLoading(true);

    fetch(`/api/admin/users/${user.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.error);
        setDetail(json.data as UserDetail);
      })
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [open, user?.id]);

  // Keep local copy in sync with parent optimistic updates
  useEffect(() => {
    if (!user || !detail) return;
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            status: user.status,
            role: user.role,
          }
        : prev
    );
  }, [user?.status, user?.role]);

  if (!user) return null;

  const currentUser = detail ?? user;
  const statusMeta =
    STATUS_META[currentUser.status as keyof typeof STATUS_META] ??
    STATUS_META.active;

  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // ── Action dispatch ────────────────────────────────────────────────────────

  async function handleConfirmedAction() {
    if (!confirmAction) return;
    setIsSubmitting(true);
    try {
      await onAction(user?.id || "", confirmAction);
      setConfirmAction(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  const ACTION_META: Record<
    string,
    { label: string; description: string; destructive?: boolean }
  > = {
    activate: {
      label: "Activate User",
      description:
        "This user will be restored to active status and can log in again.",
    },
    suspend: {
      label: "Suspend User",
      description:
        "The user will be unable to log in until reactivated. Their data is preserved.",
      destructive: true,
    },
    ban: {
      label: "Ban User",
      description:
        "The user will be permanently banned and their sessions revoked. This is a severe action.",
      destructive: true,
    },
    promote: {
      label: "Promote to Admin",
      description: "This user will gain full admin access to the platform.",
      destructive: true,
    },
    demote: {
      label: "Demote to User",
      description: "This user will lose their admin privileges.",
      destructive: true,
    },
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col p-0 gap-0"
        >
          {/* ── Header ── */}
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
            {isLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="size-14 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3 w-48" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <Avatar className="size-14 shrink-0">
                  <AvatarImage src={currentUser.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-base font-bold bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 pt-0.5">
                  <SheetTitle className="text-base font-semibold truncate leading-tight">
                    {currentUser.name}
                  </SheetTitle>
                  <SheetDescription className="text-xs truncate mt-0.5">
                    {currentUser.email}
                  </SheetDescription>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
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
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                        currentUser.role === "admin"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {currentUser.role === "admin" ? "Admin" : "User"}
                    </span>
                    {currentUser.onboardingComplete && (
                      <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <BadgeCheckIcon className="size-2.5" />
                        Onboarded
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </SheetHeader>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {isLoading ? (
              <LoadingSkeleton />
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <AlertCircleIcon className="size-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Failed to load profile</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check your connection and try again.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    setError(false);
                    setIsLoading(true);
                    fetch(`/api/admin/users/${user.id}`)
                      .then((r) => r.json())
                      .then((json) => {
                        if (!json.success) throw new Error(json.error);
                        setDetail(json.data);
                      })
                      .catch(() => setError(true))
                      .finally(() => setIsLoading(false));
                  }}
                >
                  <RefreshCwIcon className="size-3.5" />
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {/* Wallet */}
                <WalletCard wallet={detail?.wallet ?? null} />

                {/* Contact info */}
                <Section title="Profile">
                  <div className="rounded-xl border border-border overflow-hidden">
                    <InfoRow
                      icon={MailIcon}
                      label="Email"
                      value={currentUser.email}
                      copyable
                    />
                    <InfoRow
                      icon={PhoneIcon}
                      label="Phone"
                      value={currentUser.phone}
                      copyable
                    />
                    <InfoRow
                      icon={CalendarIcon}
                      label="Joined"
                      value={fmtDate(currentUser.createdAt)}
                    />
                    <InfoRow
                      icon={GiftIcon}
                      label="Referral Code"
                      value={currentUser.referralCode}
                      mono
                      copyable
                    />
                    {currentUser.referralBonusAmount > 0 && (
                      <InfoRow
                        icon={GiftIcon}
                        label="Referral Earnings"
                        value={fmtNaira(currentUser.referralBonusAmount)}
                        mono
                      />
                    )}
                    {currentUser.bankAccounts.length > 0 && (
                      <InfoRow
                        icon={BuildingIcon}
                        label="Bank Accounts"
                        value={`${currentUser.bankAccounts.length} saved`}
                      />
                    )}
                  </div>
                </Section>

                {/* Recent transactions */}
                <Section
                  title="Recent Transactions"
                  count={detail?.recentTransactions.length ?? 0}
                  empty={(detail?.recentTransactions.length ?? 0) === 0}
                  emptyLabel="No transactions yet"
                >
                  <div className="rounded-xl border border-border overflow-hidden">
                    {detail?.recentTransactions.map((tx) => (
                      <TransactionRow key={tx.id} tx={tx} />
                    ))}
                  </div>
                </Section>

                {/* Active circles */}
                <Section
                  title="Active Circles"
                  count={detail?.activeCircles.length ?? 0}
                  empty={(detail?.activeCircles.length ?? 0) === 0}
                  emptyLabel="Not in any active circles"
                >
                  <div className="rounded-xl border border-border overflow-hidden">
                    {detail?.activeCircles.map((circle) => (
                      <CircleRow key={circle.id} circle={circle} />
                    ))}
                  </div>
                </Section>
              </>
            )}
          </div>

          {/* ── Action footer ── */}
          <div className="shrink-0 border-t border-border px-5 py-4 bg-muted/30 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Moderation Actions
            </p>
            <div className="grid grid-cols-2 gap-2">
              {/* Status actions */}
              {currentUser.status !== "active" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 col-span-2"
                  onClick={() => setConfirmAction("activate")}
                >
                  <UserCheckIcon className="size-3.5 text-emerald-600" />
                  Activate account
                </Button>
              )}
              {currentUser.status === "active" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setConfirmAction("suspend")}
                >
                  <ShieldOffIcon className="size-3.5 text-amber-600" />
                  Suspend
                </Button>
              )}
              {currentUser.status !== "banned" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => setConfirmAction("ban")}
                >
                  <UserXIcon className="size-3.5" />
                  Ban user
                </Button>
              )}

              <Separator className="col-span-2 my-0.5" />

              {/* Role actions */}
              {currentUser.role === "user" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 col-span-2"
                  onClick={() => setConfirmAction("promote")}
                >
                  <ShieldCheckIcon className="size-3.5 text-purple-600" />
                  Promote to Admin
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 col-span-2"
                  onClick={() => setConfirmAction("demote")}
                >
                  <UsersIcon className="size-3.5" />
                  Demote to User
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Confirm dialog ── */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction ? ACTION_META[confirmAction]?.label : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction ? ACTION_META[confirmAction]?.description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={
                confirmAction && ACTION_META[confirmAction]?.destructive
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