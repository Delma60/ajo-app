import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function StatCardSkeleton() {
  return (
    <button className="w-full text-left rounded-xl" disabled>
      <Card>
        <CardContent className="flex items-start justify-between gap-3 py-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
          <Skeleton className="size-9 rounded-xl shrink-0" />
        </CardContent>
      </Card>
    </button>
  );
}

function DisputeRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
      {/* Reporter */}
      <div className="flex items-center gap-3 shrink-0 w-52">
        <div className="relative shrink-0">
          <Skeleton className="size-9 rounded-full" />
        </div>
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
        <Skeleton className="h-3 w-32" />
      </div>

      {/* Circle */}
      <div className="hidden md:block shrink-0 w-36 space-y-1">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>

      {/* Status badge */}
      <Skeleton className="hidden sm:block h-5 w-24 rounded-full shrink-0" />

      {/* Date */}
      <Skeleton className="hidden lg:block h-3 w-20 shrink-0" />

      {/* Actions button */}
      <Skeleton className="size-7 rounded-md shrink-0" />
    </div>
  );
}

export default function AdminDisputesLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-5 rounded" />
              <Skeleton className="h-7 w-24" />
            </div>
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>

        {/* Stats strip — 5 clickable cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 w-40 rounded-lg" />
            <Skeleton className="h-8 w-48 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-4" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 w-6" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
          </div>
        </div>

        {/* Result count */}
        <Skeleton className="h-3 w-28" />

        {/* Table */}
        <Card>
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <div className="hidden xl:flex items-center gap-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <DisputeRowSkeleton key={i} />
            ))}
          </CardContent>
        </Card>

        {/* Load more */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}