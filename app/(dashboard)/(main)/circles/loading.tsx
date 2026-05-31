import { Skeleton } from "@/components/ui/skeleton";
import { CircleCardSkeleton } from "@/components/circles/card";

export default function CirclesLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-5 space-y-6">
        {/* Page header skeleton */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>

        {/* Search bar skeleton */}
        <Skeleton className="h-10 w-full rounded-lg" />

        {/* Tabs skeleton */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>

        {/* Circles grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <CircleCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
