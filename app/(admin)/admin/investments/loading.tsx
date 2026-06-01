import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3 w-16 mt-0.5" />
        </div>
        <Skeleton className="size-8 rounded-lg shrink-0" />
      </CardContent>
    </Card>
  );
}

function InvestmentRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0">
      {/* User */}
      <div className="flex items-center gap-2.5 shrink-0 w-44">
        <Skeleton className="size-8 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* Package */}
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

      {/* Status */}
      <Skeleton className="hidden sm:block h-5 w-16 rounded-full shrink-0" />

      {/* Amounts */}
      <div className="hidden md:block shrink-0 text-right space-y-1">
        <Skeleton className="h-4 w-20 ml-auto" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>

      {/* Progress */}
      <div className="hidden lg:block shrink-0 w-28 space-y-1.5">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>

      {/* Maturity date */}
      <div className="hidden xl:block shrink-0 text-right space-y-1">
        <Skeleton className="h-3 w-14 ml-auto" />
        <Skeleton className="h-3.5 w-20 ml-auto" />
      </div>

      {/* Actions */}
      <Skeleton className="size-7 rounded-md shrink-0" />
    </div>
  );
}

export default function AdminInvestmentsLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-32" />
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

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Skeleton className="h-8 flex-1 rounded-lg" />
            <Skeleton className="h-8 w-36 rounded-lg" />
            <Skeleton className="h-8 w-40 rounded-lg" />
            <Skeleton className="h-8 w-32 rounded-lg" />
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
              <Skeleton className="h-4 w-28" />
              <div className="hidden xl:flex items-center gap-4">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <InvestmentRowSkeleton key={i} />
            ))}
          </CardContent>
        </Card>

        {/* Load more */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}