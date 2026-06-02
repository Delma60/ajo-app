export default function TransactionsLoading() {
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="h-8 w-40 bg-muted rounded animate-pulse" />
      <div className="space-y-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-24 rounded-3xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
