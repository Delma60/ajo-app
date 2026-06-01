"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCwIcon,
  AlertCircleIcon,
  TrendingUpIcon,
  ChevronRightIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

import {
  InvestmentFiltersBar,
  type InvestmentFilters,
  DEFAULT_INVESTMENT_FILTERS,
} from "./filter-bar";
import { InvestmentStatsStrip } from "./stats-strip";
import { InvestmentRow } from "./investment-row";
import { InvestmentDetailSheet } from "./investment-detail-sheet";
import type { AdminInvestment, AdminInvestmentStats } from "@/lib/types/admin-investment";

// ─── Loading skeleton for rows ────────────────────────────────────────────────

function InvestmentRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2.5 shrink-0 w-44">
        <Skeleton className="size-8 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="hidden sm:block h-5 w-16 rounded-full shrink-0" />
      <div className="hidden md:block shrink-0 text-right space-y-1">
        <Skeleton className="h-4 w-20 ml-auto" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      <div className="hidden lg:block shrink-0 w-28 space-y-1.5">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="hidden xl:block shrink-0 text-right space-y-1">
        <Skeleton className="h-3 w-14 ml-auto" />
        <Skeleton className="h-3.5 w-20 ml-auto" />
      </div>
      <Skeleton className="size-7 rounded-md shrink-0" />
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

export function AdminInvestmentsContent() {
  const [investments, setInvestments] = useState<AdminInvestment[]>([]);
  const [stats, setStats] = useState<AdminInvestmentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [detailInvestment, setDetailInvestment] = useState<AdminInvestment | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    action: "force_withdraw" | "cancel";
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [filters, setFilters] = useState<InvestmentFilters>(DEFAULT_INVESTMENT_FILTERS);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchInvestments = useCallback(
    async (cursor: string | null = null, reset = true) => {
      reset ? setIsLoading(true) : setIsLoadingMore(true);
      setHasError(false);

      try {
        const params = new URLSearchParams({ limit: "30" });
        if (filters.status !== "all") params.set("status", filters.status);
        if (filters.category !== "all") params.set("category", filters.category);
        if (filters.riskLevel !== "all") params.set("riskLevel", filters.riskLevel);
        if (filters.search.trim()) params.set("search", filters.search.trim());
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/admin/investments?${params}`);
        const json = await res.json();

        if (!json.success) throw new Error(json.error ?? "Failed to load investments");

        setInvestments((prev) => (reset ? json.data : [...prev, ...json.data]));
        setHasMore(json.meta?.hasMore ?? false);
        setNextCursor(json.meta?.nextCursor ?? null);
        if (reset && json.meta?.stats) setStats(json.meta.stats);
      } catch (err) {
        setHasError(true);
        toast.error(err instanceof Error ? err.message : "Failed to load investments");
      } finally {
        reset ? setIsLoading(false) : setIsLoadingMore(false);
      }
    },
    [filters]
  );

  // Debounce on search, immediate on other filter changes
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const delay = filters.search ? 400 : 0;
    searchTimerRef.current = setTimeout(() => {
      fetchInvestments(null, true);
    }, delay);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [filters, fetchInvestments]);

  // ── Inline action from row dropdown ───────────────────────────────────────

  function handleAction(id: string, action: "force_withdraw" | "cancel") {
    setConfirmAction({ id, action });
  }

  async function handleConfirmedAction() {
    if (!confirmAction) return;
    setIsSubmitting(true);
    setProcessingId(confirmAction.id);
    try {
      const res = await fetch(`/api/admin/investments/${confirmAction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirmAction.action }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Action failed");

      const labels: Record<string, string> = {
        force_withdraw: "Investment paid out successfully",
        cancel: "Investment cancelled and principal refunded",
      };
      toast.success(labels[confirmAction.action]);

      const newStatus =
        confirmAction.action === "force_withdraw" ? "withdrawn" : "cancelled";
      setInvestments((prev) =>
        prev.map((inv) =>
          inv.id !== confirmAction.id ? inv : { ...inv, status: newStatus as any }
        )
      );
      if (detailInvestment?.id === confirmAction.id) {
        setDetailInvestment((prev) =>
          prev ? { ...prev, status: newStatus as any } : prev
        );
      }
      setConfirmAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setIsSubmitting(false);
      setProcessingId(null);
    }
  }

  // ── Detail sheet action complete callback ─────────────────────────────────

  function handleDetailActionComplete(
    id: string,
    newStatus: "withdrawn" | "cancelled"
  ) {
    setInvestments((prev) =>
      prev.map((inv) =>
        inv.id !== id ? inv : { ...inv, status: newStatus }
      )
    );
  }

  // ── Count active filters ──────────────────────────────────────────────────

  const activeFilterCount = [
    filters.status !== "all",
    filters.category !== "all",
    filters.riskLevel !== "all",
    !!filters.dateFrom,
    !!filters.dateTo,
  ].filter(Boolean).length;

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUpIcon className="size-5 text-muted-foreground" />
              Investments
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor all investment positions, process payouts, and manage the platform portfolio.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchInvestments(null, true)}
            className="gap-1.5 self-start sm:self-auto"
            disabled={isLoading}
          >
            <RefreshCwIcon
              className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* ── Stats strip ── */}
        <InvestmentStatsStrip stats={stats} isLoading={isLoading} />

        {/* ── Filters ── */}
        <InvestmentFiltersBar
          filters={filters}
          onChange={setFilters}
          activeCount={activeFilterCount}
          onClear={() => setFilters(DEFAULT_INVESTMENT_FILTERS)}
        />

        {/* ── Result count ── */}
        {!isLoading && !hasError && (
          <p className="text-xs text-muted-foreground">
            {investments.length} investment{investments.length !== 1 ? "s" : ""}
            {hasMore ? "+" : ""} found
          </p>
        )}

        {/* ── Table ── */}
        <Card>
          <CardHeader className="border-b py-3 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm text-muted-foreground font-normal">
                {isLoading
                  ? "Loading…"
                  : `${investments.length} result${investments.length !== 1 ? "s" : ""}${hasMore ? "+" : ""}`}
              </CardTitle>
              {/* Column labels — desktop only */}
              <div className="hidden xl:flex items-center gap-1 text-xs text-muted-foreground pr-8 space-x-3">
                <span className="w-44">User</span>
                <span className="flex-1">Package</span>
                <span className="w-16 text-center">Status</span>
                <span className="w-32 text-right">Principal → Return</span>
                <span className="w-28 text-center">Progress</span>
                <span className="w-24 text-right">Matures</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div>
                {Array.from({ length: 10 }).map((_, i) => (
                  <InvestmentRowSkeleton key={i} />
                ))}
              </div>
            ) : hasError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircleIcon className="size-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium">Failed to load investments</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check your connection and try again.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchInvestments(null, true)}
                  className="gap-1.5"
                >
                  <RefreshCwIcon className="size-3.5" />
                  Retry
                </Button>
              </div>
            ) : investments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <TrendingUpIcon className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No investments found</p>
                <p className="text-xs text-muted-foreground">
                  {activeFilterCount > 0 || filters.search
                    ? "Try adjusting your filters."
                    : "No investment positions have been created yet."}
                </p>
              </div>
            ) : (
              <div>
                {investments.map((inv) => (
                  <InvestmentRow
                    key={inv.id}
                    investment={inv}
                    onOpenDetail={setDetailInvestment}
                    onAction={handleAction}
                    isProcessing={processingId === inv.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Load more ── */}
        {hasMore && !isLoading && !hasError && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {investments.length} investment
              {investments.length !== 1 ? "s" : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoadingMore}
              onClick={() => fetchInvestments(nextCursor, false)}
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

      {/* ── Detail sheet ── */}
      <InvestmentDetailSheet
        investment={detailInvestment}
        open={!!detailInvestment}
        onOpenChange={(open) => !open && setDetailInvestment(null)}
        onActionComplete={handleDetailActionComplete}
      />

      {/* ── Confirm dialog for inline row actions ── */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction ? ACTION_META[confirmAction.action].label : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction
                ? ACTION_META[confirmAction.action].description
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={
                confirmAction && ACTION_META[confirmAction.action].destructive
                  ? "destructive"
                  : "default"
              }
              disabled={isSubmitting}
              onClick={handleConfirmedAction}
            >
              {isSubmitting
                ? "Processing…"
                : confirmAction
                  ? ACTION_META[confirmAction.action].confirmLabel
                  : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}