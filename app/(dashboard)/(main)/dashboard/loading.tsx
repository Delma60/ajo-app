import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function LoadingStatCard() {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3 py-1">
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

function LoadingCircleCard() {
  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="flex justify-between gap-2">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-5 space-y-6">

        {/* Greeting skeleton */}
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>

        {/* Balance card skeleton */}
        <Skeleton className="h-[172px] rounded-2xl" />

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingStatCard key={i} />
          ))}
        </div>

        {/* Circles section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-14" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LoadingCircleCard />
            <LoadingCircleCard />
          </div>
        </div>

        {/* Transactions skeleton */}
        <Card>
          <CardHeader className="border-b">
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Skeleton className="size-8 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}