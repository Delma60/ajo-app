export default function AdminEventsLoading() {
  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div className="space-y-2">
        <div className="h-10 w-64 bg-muted rounded-lg animate-pulse" />
        <div className="h-4 w-80 bg-muted rounded animate-pulse" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>

      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-muted rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
