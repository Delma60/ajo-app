import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function CircleRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
      {/* Name + description */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-14 rounded" />
        </div>
        <Skeleton className="h-3 w-60" />
      </div>

      {/* Status badge */}
      <Skeleton className="h-5 w-16 rounded-full hidden sm:block" />

      {/* Type / Freq */}
      <div className="hidden md:block space-y-1 shrink-0">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-14" />
      </div>

      {/* Member fill */}
      <div className="hidden lg:block w-28 space-y-1 shrink-0">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>

      {/* Trust score */}
      <div className="hidden lg:block w-20 text-right shrink-0 space-y-1">
        <Skeleton className="h-4 w-14 ml-auto" />
        <Skeleton className="h-3 w-10 ml-auto" />
      </div>

      {/* Contribution */}
      <div className="hidden xl:block text-right shrink-0 space-y-1">
        <Skeleton className="h-3.5 w-20 ml-auto" />
        <Skeleton className="h-3 w-14 ml-auto" />
      </div>

      {/* Created */}
      <Skeleton className="hidden xl:block h-3.5 w-20 shrink-0" />

      {/* Action button */}
      <Skeleton className="size-7 rounded-md shrink-0" />
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="size-8 rounded-lg shrink-0" />
      </div>
    </div>
  );
}

export default function AdminCirclesLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Skeleton className="h-8 flex-1 rounded-lg" />
          <Skeleton className="h-8 w-36 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-40 rounded-lg" />
        </div>

        {/* Count */}
        <Skeleton className="h-3 w-24" />

        {/* Table */}
        <Card>
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <div className="hidden xl:flex items-center gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <CircleRowSkeleton key={i} />
            ))}
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}