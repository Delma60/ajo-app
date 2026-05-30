import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DepositLoading() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-lg mx-auto px-4 md:px-6 py-5 space-y-6">
        {/* Back nav */}
        <Skeleton className="h-4 w-24" />

        {/* Page title */}
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Balance tile */}
        <Skeleton className="h-20 rounded-xl" />

        {/* Trust badges */}
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>

        {/* Preset amounts */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Custom amount input */}
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>

        {/* Summary card */}
        <Skeleton className="h-24 rounded-xl" />

        {/* Submit button */}
        <Skeleton className="h-10 w-full rounded-lg" />

        {/* Security note */}
        <Skeleton className="h-4 w-56 mx-auto" />
      </div>
    </div>
  );
}