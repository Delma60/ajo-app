import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

function NotificationRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0">
      <Skeleton className="size-9 rounded-xl shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="size-2 rounded-full shrink-0 mt-1.5" />
    </div>
  );
}

export default function NotificationsLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-8 w-28 rounded-md shrink-0" />
        </div>

        {/* Filter tabs skeleton */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <Skeleton className="h-7 w-12 rounded-md" />
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>

        {/* Notifications List */}
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <NotificationRowSkeleton key={i} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
