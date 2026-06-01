"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCwIcon,
  AlertCircleIcon,
  GavelIcon,
  ChevronRightIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import {
  DisputeFiltersBar,
  DEFAULT_DISPUTE_FILTERS,
  type DisputeFilters,
} from "./filter-bar";
import { DisputeStatsStrip } from "./stats-strip";
import { DisputeRow } from "./dispute-row";
import { DisputeDetailSheet } from "./dispute-detail-sheet";
import type { AdminDispute, AdminDisputeStats } from "@/lib/types/admin-dispute";

// ─── Row skeleton ─────────────────────────────────────────────────────────────

function DisputeRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
      {/* Reporter */}
      <div className="flex items-center gap-3 shrink-0 w-52">
        <Skeleton className="size-9 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* Type + description */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <Skeleton className="h-3 w-56" />
      </div>

      {/* Circle */}
      <div className="hidden md:block shrink-0 w-36 space-y-1">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>

      {/* Status */}
      <Skeleton className="hidden sm:block h-5 w-24 rounded-full shrink-0" />

      {/* Date */}
      <Skeleton className="hidden lg:block h-3 w-20 shrink-0" />

      {/* Actions button */}
      <Skeleton className="size-7 rounded-md shrink-0" />
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

export function AdminDisputesContent() {
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [stats, setStats] = useState<AdminDisputeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [detailDispute, setDetailDispute] = useState<AdminDispute | null>(null);
  const [detailInitialAction, setDetailInitialAction] = useState<
    "resolve" | "dismiss" | null
  >(null);

  const [filters, setFilters] = useState<DisputeFilters>(DEFAULT_DISPUTE_FILTERS);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchDisputes = useCallback(
    async (cursor: string | null = null, reset = true) => {
      reset ? setIsLoading(true) : setIsLoadingMore(true);
      setHasError(false);

      try {
        const params = new URLSearchParams({ limit: "30" });
        if (filters.status !== "all") params.set("status", filters.status);
        if (filters.type !== "all") params.set("type", filters.type);
        if (filters.search.trim()) params.set("search", filters.search.trim());
        if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) params.set("dateTo", filters.dateTo);
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/admin/disputes?${params}`);
        const json = await res.json();

        if (!json.success) throw new Error(json.error ?? "Failed to load disputes");

        setDisputes((prev) => (reset ? json.data : [...prev, ...json.data]));
        setHasMore(json.meta?.hasMore ?? false);
        setNextCursor(json.meta?.nextCursor ?? null);
        if (reset && json.meta?.stats) setStats(json.meta.stats);
      } catch (err) {
        setHasError(true);
        toast.error(err instanceof Error ? err.message : "Failed to load disputes");
      } finally {
        reset ? setIsLoading(false) : setIsLoadingMore(false);
      }
    },
    [filters]
  );

  // Debounce search; immediate on other filter changes
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const delay = filters.search ? 400 : 0;
    searchTimerRef.current = setTimeout(() => {
      fetchDisputes(null, true);
    }, delay);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [filters, fetchDisputes]);

  // ── Quick action from row dropdown ─────────────────────────────────────────

  async function handleQuickAction(id: string, action: string) {
    // These actions require the detail sheet (they need resolution notes or confirmation)
    if (action === "resolve" || action === "dismiss") {
      const target = disputes.find((d) => d.id === id);
      if (target) {
        setDetailInitialAction(action as "resolve" | "dismiss");
        setDetailDispute(target);
      }
      return;
    }

    // mark_under_review can be done inline without sheet
    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/disputes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Action failed");

      toast.success("Dispute marked as under review");

      // Optimistic update
      setDisputes((prev) =>
        prev.map((d) =>
          d.id !== id ? d : { ...d, status: "under_review" as const }
        )
      );
      // Update stats
      setStats((prev) =>
        prev
          ? {
              ...prev,
              open: Math.max(0, prev.open - 1),
              under_review: prev.under_review + 1,
            }
          : prev
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setProcessingId(null);
    }
  }

  // ── Sheet action complete ──────────────────────────────────────────────────

  function handleActionComplete(
    id: string,
    newStatus: "under_review" | "resolved" | "dismissed"
  ) {
    setDisputes((prev) =>
      prev.map((d) => (d.id !== id ? d : { ...d, status: newStatus }))
    );

    // Update stats counts
    setStats((prev) => {
      if (!prev) return prev;
      const oldStatus = disputes.find((d) => d.id === id)?.status;
      const next = { ...prev };
      if (oldStatus && oldStatus in next)
        next[oldStatus as keyof AdminDisputeStats] = Math.max(
          0,
          (next[oldStatus as keyof AdminDisputeStats] as number) - 1
        );
      if (newStatus in next)
        (next[newStatus as keyof AdminDisputeStats] as number)++;
      return next;
    });

    setDetailDispute(null);
    setDetailInitialAction(null);
  }

  // ── Active filter count ────────────────────────────────────────────────────

  const activeFilterCount = [
    filters.status !== "all",
    filters.type !== "all",
    !!filters.dateFrom,
    !!filters.dateTo,
  ].filter(Boolean).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <GavelIcon className="size-5 text-muted-foreground" />
              Disputes
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review, investigate, and resolve member disputes across all circles.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchDisputes(null, true)}
            className="gap-1.5 self-start sm:self-auto"
            disabled={isLoading}
          >
            <RefreshCwIcon
              className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Stats strip — clicking a stat filters the list */}
        <DisputeStatsStrip
          stats={stats}
          isLoading={isLoading}
          activeFilter={filters.status}
          onFilterChange={(status) =>
            setFilters((prev) => ({
              ...prev,
              status: status === "all" ? "all" : status,
            }))
          }
        />

        {/* Filters */}
        <DisputeFiltersBar
          filters={filters}
          onChange={setFilters}
          activeCount={activeFilterCount}
          onClear={() => setFilters(DEFAULT_DISPUTE_FILTERS)}
        />

        {/* Result count */}
        {!isLoading && !hasError && (
          <p className="text-xs text-muted-foreground">
            {disputes.length} dispute{disputes.length !== 1 ? "s" : ""}
            {hasMore ? "+" : ""} found
          </p>
        )}

        {/* Table */}
        <Card>
          <CardHeader className="border-b py-3 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm text-muted-foreground font-normal">
                {isLoading
                  ? "Loading…"
                  : `${disputes.length} result${disputes.length !== 1 ? "s" : ""}${hasMore ? "+" : ""}`}
              </CardTitle>
              {/* Column labels — desktop only */}
              <div className="hidden xl:flex items-center gap-1 text-xs text-muted-foreground pr-8 space-x-3">
                <span className="w-52">Reporter</span>
                <span className="flex-1">Type &amp; Description</span>
                <span className="w-36">Circle</span>
                <span className="w-24 text-center">Status</span>
                <span className="w-20 text-right">Raised</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div>
                {Array.from({ length: 8 }).map((_, i) => (
                  <DisputeRowSkeleton key={i} />
                ))}
              </div>
            ) : hasError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircleIcon className="size-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm font-medium">Failed to load disputes</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check your connection and try again.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchDisputes(null, true)}
                  className="gap-1.5"
                >
                  <RefreshCwIcon className="size-3.5" />
                  Retry
                </Button>
              </div>
            ) : disputes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <GavelIcon className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No disputes found</p>
                <p className="text-xs text-muted-foreground">
                  {activeFilterCount > 0 || filters.search
                    ? "Try adjusting your filters."
                    : "No disputes have been raised yet. That's a good sign!"}
                </p>
              </div>
            ) : (
              <div>
                {disputes.map((dispute) => (
                  <DisputeRow
                    key={dispute.id}
                    dispute={dispute}
                    onOpenDetail={(d) => {
                      setDetailInitialAction(
                        (d as any)._quickAction ?? null
                      );
                      setDetailDispute(d);
                    }}
                    onQuickAction={handleQuickAction}
                    isProcessing={processingId === dispute.id}
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
              Showing {disputes.length} dispute{disputes.length !== 1 ? "s" : ""}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoadingMore}
              onClick={() => fetchDisputes(nextCursor, false)}
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

      {/* Detail sheet */}
      <DisputeDetailSheet
        dispute={detailDispute}
        open={!!detailDispute}
        onOpenChange={(open) => {
          if (!open) {
            setDetailDispute(null);
            setDetailInitialAction(null);
          }
        }}
        onActionComplete={handleActionComplete}
        initialAction={detailInitialAction}
      />
    </div>
  );
}