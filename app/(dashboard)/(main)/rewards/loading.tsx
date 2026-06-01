export default function RewardsLoading() {
  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-10 w-64 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-80 bg-muted rounded animate-pulse" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-4 border-b">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-24 bg-muted rounded-t animate-pulse" />
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
