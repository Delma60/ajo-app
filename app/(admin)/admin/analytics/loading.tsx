import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function ChartSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <Skeleton className={`w-full rounded-lg ${height}`} />
      </CardContent>
    </Card>
  );
}

function StatPillSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export default function AdminAnalyticsLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-64" />
          </div>
          {/* Range selector */}
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>

        {/* KPI pills */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatPillSkeleton key={i} />
          ))}
        </div>

        {/* Volume + User growth charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton height="h-60" />
          <ChartSkeleton height="h-60" />
        </div>

        {/* Tx breakdown + circles created */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton height="h-52" />
          <ChartSkeleton height="h-52" />
        </div>

        {/* Retention + Top circles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Retention */}
          <Card>
            <CardHeader className="border-b pb-3">
              <Skeleton className="h-4 w-36" />
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top circles */}
          <Card>
            <CardHeader className="border-b pb-3">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="pt-3 space-y-0 divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <Skeleton className="size-7 rounded-md shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-2.5 w-full rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}