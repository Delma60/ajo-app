import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-12" />
        </div>
        <Skeleton className="size-9 rounded-xl shrink-0" />
      </CardContent>
    </Card>
  );
}

function NotificationRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0">
      {/* Unread dot */}
      <Skeleton className="size-2 rounded-full shrink-0 mt-2" />

      {/* Type icon */}
      <Skeleton className="size-9 rounded-xl shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-72" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full shrink-0" />
        </div>
        {/* User + date row */}
        <div className="flex items-center gap-2 mt-1">
          <Skeleton className="size-5 rounded-full shrink-0" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-2 rounded" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Action button */}
      <Skeleton className="size-7 rounded-md shrink-0" />
    </div>
  );
}

export default function AdminNotificationsLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex gap-2 shrink-0">
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Skeleton className="h-8 flex-1 rounded-lg" />
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>

        {/* Result count */}
        <Skeleton className="h-3 w-28" />

        {/* Table */}
        <Card>
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-7 w-28 rounded-lg" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <NotificationRowSkeleton key={i} />
            ))}
          </CardContent>
        </Card>

        {/* Load more */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}