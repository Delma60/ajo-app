"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCwIcon,
  AlertCircleIcon,
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

import { CircleFiltersBar, type CircleFilters } from "./filter-bar";
import { CircleStatsStrip } from "./stats-strip";
import { CircleRow } from "./circle-row";
import { CircleDetailSheet } from "./circle-detail-sheet";
import type { AdminCircle } from "@/lib/types/admin-circle";

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CircleRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full hidden sm:block" />
      <div className="hidden md:block space-y-1">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="hidden lg:block w-28 space-y-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="hidden lg:block w-20 text-right space-y-1">
        <Skeleton className="h-4 w-14 ml-auto" />
        <Skeleton className="h-3 w-10 ml-auto" />
      </div>
      <Skeleton className="size-7 rounded-md" />
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

export function AdminCirclesContent() {
  const [circles, setCircles] = useState<AdminCircle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [detailCircle, setDetailCircle] = useState<AdminCircle | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [filters, setFilters] = useState<CircleFilters>({
    search: "",
    status: "all",
    payoutOrder: "all",
    frequency: "all",
    orderBy: "createdAt",
    order: "desc",
  });

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCircles = useCallback(
    async (cursor: string | null = null, reset = true) => {
      reset ? setIsLoading(true) : setIsLoadingMore(true);
      setHasError(false);

      try {
        const params = new URLSearchParams({ limit: "20", orderBy: filters.orderBy, order: filters.order });
        if (filters.status !== "all") params.set("status", filters.status);
        if (filters.search.trim()) params.set("search", filters.search.trim());
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/admin/circles?${params}`);
        const json = await res.json();

        if (!json.success) throw new Error(json.error ?? "Failed to load circles");

        const raw: any[] = json.data ?? [];

        // Client-side enrich with derived fields
        const enriched: AdminCircle[] = raw
          .map((c) => ({
            ...c,
            memberCount: c.memberCount ?? c.memberIds?.length ?? 0,
            fillPercent: c.fillPercent ?? Math.round(((c.memberCount ?? c.memberIds?.length ?? 0) / c.maxMembers) * 100),
          }))
          // Client-side payout order filter (API doesn't support it without composite index)
          .filter((c) => filters.payoutOrder === "all" || c.payoutOrder === filters.payoutOrder)
          // Client-side frequency filter
          .filter((c) => filters.frequency === "all" || c.frequency === filters.frequency);

        setCircles((prev) => (reset ? enriched : [...prev, ...enriched]));
        setHasMore(json.meta?.hasMore ?? false);
        setNextCursor(json.meta?.nextCursor ?? null);
      } catch (err) {
        setHasError(true);
        toast.error(err instanceof Error ? err.message : "Failed to load circles");
      } finally {
        reset ? setIsLoading(false) : setIsLoadingMore(false);
      }
    },
    [filters]
  );

  // Debounce on search change, immediate on other filter changes
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const delay = filters.search ? 350 : 0;
    searchTimerRef.current = setTimeout(() => {
      fetchCircles(null, true);
    }, delay);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [filters, fetchCircles]);

  // ── Single action (pause / unpause) ───────────────────────────────────────

  async function handleAction(
    id: string,
    action: "pause" | "unpause" | "cancel"
  ) {
    // Cancel goes through confirmation dialog
    if (action === "cancel") {
      setCancelTarget(id);
      return;
    }

    setProcessingId(id);
    try {
      const res = await fetch(`/api/circles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Action failed");

      const actionLabels = { pause: "Circle paused", unpause: "Circle resumed" };
      toast.success(actionLabels[action]);

      // Optimistic update
      setCircles((prev) =>
        prev.map((c) =>
          c.id !== id
            ? c
            : { ...c, status: action === "pause" ? "paused" : "active" }
        )
      );
      if (detailCircle?.id === id) {
        setDetailCircle((prev) =>
          prev ? { ...prev, status: action === "pause" ? "paused" : "active" } : prev
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setProcessingId(null);
    }
  }

  // ── Cancel (confirmed) ────────────────────────────────────────────────────

  async function handleCancelConfirmed() {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/circles/${cancelTarget}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Cancel failed");

      toast.success("Circle cancelled");

      setCircles((prev) =>
        prev.map((c) =>
          c.id !== cancelTarget ? c : { ...c, status: "cancelled" }
        )
      );
      if (detailCircle?.id === cancelTarget) {
        setDetailCircle((prev) =>
          prev ? { ...prev, status: "cancelled" } : prev
        );
      }
      setCancelTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setIsCancelling(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Circles</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Monitor, manage, and act on all savings circles across the platform.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCircles(null, true)}
            className="gap-1.5 self-start sm:self-auto"
          >
            <RefreshCwIcon className="size-3.5" />
            Refresh
          </Button>
        </div>

        {/* Stats strip */}
        <CircleStatsStrip circles={circles as any} isLoading={isLoading} />

        {/* Filters */}
        <CircleFiltersBar filters={filters} onChange={setFilters} />

        {/* Circle count */}
        {!isLoading && !hasError && (
          <p className="text-xs text-muted-foreground">
            {circles.length} circle{circles.length !== 1 ? "s" : ""}
            {hasMore ? "+" : ""} found
          </p>
        )}

        {/* Table */}
        <Card>
          <CardHeader className="border-b py-3 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm text-muted-foreground font-normal">
                {isLoading ? "Loading…" : `${circles.length} circle${circles.length !== 1 ? "s" : ""}${hasMore ? "+" : ""}`}
              </CardTitle>
              {/* Column labels — desktop only */}
              <div className="hidden xl:flex items-center gap-2 text-xs text-muted-foreground pr-8">
                <span className="w-20 text-center">Status</span>
                <span className="w-32 text-center">Type / Freq</span>
                <span className="w-28 text-center">Members</span>
                <span className="w-20 text-center">Trust</span>
                <span className="w-24 text-right">Contribution</span>
                <span className="w-24 text-right">Created</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div>
                {Array.from({ length: 8 }).map((_, i) => (
                  <CircleRowSkeleton key={i} />
                ))}
              </div>
            ) : hasError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircleIcon className="size-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium">Failed to load circles</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check your connection and try again.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchCircles(null, true)}
                  className="gap-1.5"
                >
                  <RefreshCwIcon className="size-3.5" />
                  Retry
                </Button>
              </div>
            ) : circles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <svg className="size-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
                  </svg>
                </div>
                <p className="text-sm font-medium">No circles found</p>
                <p className="text-xs text-muted-foreground">
                  {filters.search || filters.status !== "all"
                    ? "Try adjusting your filters."
                    : "No savings circles have been created yet."}
                </p>
              </div>
            ) : (
              <div>
                {circles.map((circle) => (
                  <CircleRow
                    key={circle.id}
                    circle={circle}
                    onAction={handleAction}
                    onOpenDetail={setDetailCircle}
                    isProcessing={processingId === circle.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Load more */}
        {hasMore && !isLoading && !hasError && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {circles.length} circles
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoadingMore}
              onClick={() => fetchCircles(nextCursor, false)}
              className="gap-1.5"
            >
              {isLoadingMore ? (
                <RefreshCwIcon className="size-3.5 animate-spin" />
              ) : null}
              {isLoadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <CircleDetailSheet
        circle={detailCircle}
        open={!!detailCircle}
        onOpenChange={(open) => !open && setDetailCircle(null)}
        onAction={handleAction}
      />

      {/* Cancel confirmation */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this circle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently cancel the circle and cancel all pending
              contributions. Members will be notified. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Keep Circle
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isCancelling}
              onClick={handleCancelConfirmed}
            >
              {isCancelling ? "Cancelling…" : "Yes, Cancel Circle"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}