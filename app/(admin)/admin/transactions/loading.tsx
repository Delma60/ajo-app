import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="size-8 rounded-lg shrink-0" />
      </CardContent>
    </Card>
  );
}

function TransactionRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
      {/* Type icon */}
      <Skeleton className="size-9 rounded-xl shrink-0" />

      {/* Description + reference */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-64" />
        <Skeleton className="h-3 w-36" />
      </div>

      {/* User */}
      <div className="hidden md:flex items-center gap-2 w-40 shrink-0">
        <Skeleton className="size-6 rounded-full shrink-0" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-32" />
        </div>
      </div>

      {/* Type badge */}
      <Skeleton className="hidden lg:block h-5 w-20 rounded-full shrink-0" />

      {/* Status */}
      <Skeleton className="hidden sm:block h-4 w-14 shrink-0" />

      {/* Date */}
      <Skeleton className="hidden xl:block h-3.5 w-20 shrink-0" />

      {/* Amount */}
      <div className="text-right shrink-0 space-y-1">
        <Skeleton className="h-4 w-20 ml-auto" />
      </div>
    </div>
  );
}

export default function AdminTransactionsLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Filters bar */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 w-36 rounded-lg" />
            <Skeleton className="h-8 w-36 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-4 rounded" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 w-6 rounded" />
            <Skeleton className="h-8 flex-1 rounded-lg" />
          </div>
        </div>

        {/* Result count */}
        <Skeleton className="h-3 w-32" />

        {/* Table */}
        <Card>
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <div className="hidden xl:flex items-center gap-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {Array.from({ length: 12 }).map((_, i) => (
              <TransactionRowSkeleton key={i} />
            ))}
          </CardContent>
        </Card>

        {/* Load more / pagination */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}