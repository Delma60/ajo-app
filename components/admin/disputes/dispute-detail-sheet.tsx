"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  RefreshCwIcon,
  AlertCircleIcon,
  ExternalLinkIcon,
  CheckCircle2Icon,
  XCircleIcon,
  SearchIcon,
  UserIcon,
  MailIcon,
  PhoneIcon,
  CalendarIcon,
  CopyIcon,
  CheckIcon,
  MessageSquareIcon,
  CircleDollarSignIcon,
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
  DISPUTE_STATUS_META,
  DISPUTE_TYPE_META,
  type AdminDispute,
} from "@/lib/types/admin-dispute";

// ─── Extended detail from GET /api/admin/disputes/[id] ───────────────────────

interface DisputeDetail extends AdminDispute {
  circleStatus: string;
  reporterPhone: string;
  againstUserPhone: string | null;
  againstUserAvatarUrl: string | null;
  allowedTransitions: string[];
  resolvedByName: string | null;
}

interface DisputeDetailSheetProps {
  dispute: AdminDispute | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: (
    id: string,
    newStatus: "under_review" | "resolved" | "dismissed"
  ) => void;
  initialAction?: "resolve" | "dismiss" | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    month: "long",
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
      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
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
            valueClassName
          )}
        >
          {value || "—"}
        </p>
      </div>
      {copyable && value && <CopyButton value={value} />}
    </div>
  );
}

// ─── User card ────────────────────────────────────────────────────────────────

function UserCard({
  title,
  name,
  email,
  phone,
  avatarUrl,
  badge,
}: {
  title: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string | null;
  badge?: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-3 py-2 bg-muted/40 border-b border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-10 shrink-0">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-foreground truncate leading-tight">
                {name}
              </p>
              {badge && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">
                  {badge}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </div>
        {phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <PhoneIcon className="size-3 shrink-0" />
            <span className="font-mono">{phone}</span>
            <CopyButton value={phone} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-5 p-1">
      {/* Header area */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      {/* User cards */}
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      {/* Description */}
      <Skeleton className="h-28 rounded-xl" />
      {/* Info rows */}
      <div className="space-y-0 rounded-xl border border-border overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-0">
            <Skeleton className="size-7 rounded-lg shrink-0" />
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

// ─── Action configs ───────────────────────────────────────────────────────────

const ACTION_META = {
  mark_under_review: {
    label: "Mark Under Review",
    description:
      "This will move the dispute to 'Under Review' status and notify the reporter that their case is being investigated.",
    requiresResolution: false,
    destructive: false,
    confirmLabel: "Mark Under Review",
    newStatus: "under_review" as const,
  },
  resolve: {
    label: "Resolve Dispute",
    description:
      "Provide resolution notes explaining the outcome. The reporter will be notified by email and in-app notification.",
    requiresResolution: true,
    destructive: false,
    confirmLabel: "Resolve Dispute",
    newStatus: "resolved" as const,
  },
  dismiss: {
    label: "Dismiss Dispute",
    description:
      "Provide notes explaining why this dispute is being dismissed. The reporter will be notified of the decision.",
    requiresResolution: true,
    destructive: true,
    confirmLabel: "Dismiss Dispute",
    newStatus: "dismissed" as const,
  },
};

// ─── Main sheet ───────────────────────────────────────────────────────────────

export function DisputeDetailSheet({
  dispute,
  open,
  onOpenChange,
  onActionComplete,
  initialAction,
}: DisputeDetailSheetProps) {
  const [detail, setDetail] = useState<DisputeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [confirmAction, setConfirmAction] = useState<keyof typeof ACTION_META | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load detail when sheet opens
  useEffect(() => {
    if (!open || !dispute) return;
    setDetail(null);
    setHasError(false);
    setResolutionNotes("");
    loadDetail(dispute.id);
  }, [open, dispute?.id]);

  // Auto-open confirm dialog if initialAction is set
  useEffect(() => {
    if (open && initialAction && detail) {
      setConfirmAction(initialAction);
    }
  }, [open, initialAction, detail]);

  async function loadDetail(id: string) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/disputes/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed to load");
      setDetail(json.data as DisputeDetail);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmedAction() {
    if (!confirmAction || !dispute) return;

    const meta = ACTION_META[confirmAction];
    if (meta.requiresResolution && !resolutionNotes.trim()) {
      toast.error("Resolution notes are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/disputes/${dispute.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: confirmAction,
          resolution: resolutionNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Action failed");

      const labels: Record<string, string> = {
        mark_under_review: "Dispute marked under review",
        resolve: "Dispute resolved successfully",
        dismiss: "Dispute dismissed",
      };
      toast.success(labels[confirmAction]);

      onActionComplete(dispute.id, meta.newStatus);
      setConfirmAction(null);
      setResolutionNotes("");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!dispute) return null;

  const current = detail ?? dispute;
  const statusMeta = DISPUTE_STATUS_META[current.status];
  const typeMeta = DISPUTE_TYPE_META[current.type];

  const canMarkUnderReview = detail?.allowedTransitions.includes("under_review");
  const canResolve =
    detail?.allowedTransitions.includes("resolved") ||
    detail?.allowedTransitions.includes("dismissed");
  const isActionable = canMarkUnderReview || canResolve;

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
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xl shrink-0">{typeMeta.icon}</span>
                    <div className="min-w-0">
                      <SheetTitle className="text-base font-semibold leading-tight">
                        {typeMeta.label}
                      </SheetTitle>
                      <SheetDescription className="text-xs mt-0.5 truncate">
                        {current.circleName}
                      </SheetDescription>
                    </div>
                  </div>
                  {detail?.circleId && (
                    <Link
                      href={`/circles/${detail.circleId}`}
                      target="_blank"
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                    >
                      <ExternalLinkIcon className="size-4" />
                    </Link>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border",
                      statusMeta.badgeCls
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", statusMeta.dotCls)} />
                    {statusMeta.label}
                  </span>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                    ID: {current.id.slice(0, 8)}…
                  </span>
                  {detail?.circleStatus && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground capitalize">
                      Circle: {detail.circleStatus}
                    </span>
                  )}
                </div>
              </div>
            )}
          </SheetHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {isLoading && !detail ? (
              <DetailSkeleton />
            ) : hasError ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <AlertCircleIcon className="size-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Failed to load dispute details</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check your connection and try again.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => loadDetail(dispute.id)}
                >
                  <RefreshCwIcon className="size-3.5" />
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {/* Reporter */}
                <UserCard
                  title="Reported By"
                  name={current.reporterName}
                  email={current.reporterEmail}
                  phone={detail?.reporterPhone}
                  avatarUrl={current.reporterAvatarUrl}
                />

                {/* Accused (if any) */}
                {current.againstUserId && current.againstUserName && (
                  <UserCard
                    title="Accused Member"
                    name={current.againstUserName}
                    email={current.againstUserEmail ?? ""}
                    phone={detail?.againstUserPhone ?? undefined}
                    avatarUrl={detail?.againstUserAvatarUrl}
                    badge="Accused"
                  />
                )}

                {/* Description */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Description
                  </p>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {current.description}
                    </p>
                  </div>
                </div>

                {/* Resolution (if resolved/dismissed) */}
                {current.resolution && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Resolution Notes
                    </p>
                    <div
                      className={cn(
                        "rounded-xl border p-4",
                        current.status === "resolved"
                          ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/30"
                          : "bg-muted/30 border-border"
                      )}
                    >
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {current.resolution}
                      </p>
                      {current.resolvedByName && (
                        <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border">
                          Resolved by {current.resolvedByName} on{" "}
                          {fmtDate(current.resolvedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Timeline & references */}
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Details
                  </p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <InfoRow
                      icon={CalendarIcon}
                      label="Date Raised"
                      value={fmtDateTime(current.createdAt)}
                    />
                    <InfoRow
                      icon={CalendarIcon}
                      label="Last Updated"
                      value={fmtDateTime(current.updatedAt)}
                    />
                    <InfoRow
                      icon={CircleDollarSignIcon}
                      label="Circle"
                      value={current.circleName}
                    />
                    {current.circleId && (
                      <InfoRow
                        icon={CircleDollarSignIcon}
                        label="Circle ID"
                        value={current.circleId}
                        mono
                        copyable
                      />
                    )}
                    <InfoRow
                      icon={MessageSquareIcon}
                      label="Dispute ID"
                      value={current.id}
                      mono
                      copyable
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action footer */}
          {!hasError && detail && isActionable && (
            <div className="shrink-0 border-t border-border px-5 py-4 bg-muted/30 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Admin Actions
              </p>
              <div className="flex flex-col gap-2">
                {canMarkUnderReview && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 justify-start"
                    onClick={() => setConfirmAction("mark_under_review")}
                  >
                    <SearchIcon className="size-3.5 text-amber-600" />
                    Mark Under Review
                  </Button>
                )}
                {canResolve && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setConfirmAction("resolve")}
                    >
                      <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                      Resolve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                      onClick={() => setConfirmAction("dismiss")}
                    >
                      <XCircleIcon className="size-3.5" />
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirm dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
            setResolutionNotes("");
          }
        }}
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

          {confirmAction && ACTION_META[confirmAction].requiresResolution && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">
                Resolution Notes{" "}
                <span className="text-destructive">*</span>
              </p>
              <Textarea
                placeholder="Describe the investigation findings and the decision reached…"
                rows={4}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="resize-none text-sm"
              />
              {!resolutionNotes.trim() && (
                <p className="text-[11px] text-muted-foreground">
                  Required — the reporter will see this explanation.
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isSubmitting}
              onClick={() => setResolutionNotes("")}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant={
                confirmAction && ACTION_META[confirmAction].destructive
                  ? "destructive"
                  : "default"
              }
              disabled={
                isSubmitting ||
                (confirmAction !== null &&
                  ACTION_META[confirmAction].requiresResolution &&
                  !resolutionNotes.trim())
              }
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