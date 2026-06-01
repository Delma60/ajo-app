// app/(admin)/admin/settings/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SettingsSectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg ml-auto shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-start justify-between gap-6">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-9 w-36 rounded-lg shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminSettingsLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        {/* Last updated bar */}
        <Skeleton className="h-11 rounded-xl" />

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl w-full overflow-x-auto">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 flex-1 min-w-[80px] rounded-lg" />
          ))}
        </div>

        {/* Section card */}
        <SettingsSectionSkeleton rows={5} />
        <SettingsSectionSkeleton rows={3} />
      </div>
    </div>
  );
}