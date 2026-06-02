export default function SettingsLoading() {
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="h-8 w-32 bg-muted rounded animate-pulse" />
      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-20 rounded-3xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
