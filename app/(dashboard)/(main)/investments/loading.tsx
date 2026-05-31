import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

function StatsCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="size-9 rounded-xl shrink-0" />
      </CardContent>
    </Card>
  );
}

function YieldCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 rounded" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
    </div>
  );
}

export default function InvestmentsLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-5 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="size-10 rounded-xl shrink-0" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>

        {/* Wallet banner */}
        <Skeleton className="h-14 rounded-xl" />

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <Skeleton className="h-7 w-28 rounded-md" />
          <Skeleton className="h-7 w-32 rounded-md" />
        </div>

        {/* Position cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <YieldCardSkeleton />
          <YieldCardSkeleton />
        </div>
      </div>
    </div>
  );
}