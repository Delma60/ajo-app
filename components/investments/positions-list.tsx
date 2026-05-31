"use client";

import { YieldCard } from "@/components/investments/yield-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { InvestmentEmptyState } from "@/components/investments/empty-state";
import type { InvestmentWithProgress } from "@/lib/types/investment";

interface InvestmentPositionsListProps {
  investments: InvestmentWithProgress[];
  isLoading: boolean;
}

function YieldCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        </div>
        {/* Values grid */}
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-2.5 w-28" />
          </div>
        </div>
        {/* CTA */}
        <Skeleton className="h-8 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function InvestmentPositionsList({
  investments,
  isLoading,
}: InvestmentPositionsListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <YieldCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (investments.length === 0) {
    return <InvestmentEmptyState />;
  }

  const active = investments.filter((i) => i.status === "active");
  const historical = investments.filter((i) => i.status !== "active");

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Active Positions ({active.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {active.map((inv) => (
              <YieldCard key={inv.id} investment={inv} />
            ))}
          </div>
        </section>
      )}

      {historical.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Completed ({historical.length})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {historical.map((inv) => (
              <YieldCard key={inv.id} investment={inv} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}