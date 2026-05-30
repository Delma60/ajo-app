import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      {/* Progress steps */}
      <div className="w-full max-w-lg mb-10">
        <div className="flex items-center justify-between relative">
          <div className="absolute inset-x-0 top-4 h-0.5 bg-border" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="relative z-10 flex flex-col items-center gap-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Card skeleton */}
      <div className="w-full max-w-lg bg-card ring-1 ring-foreground/10 rounded-2xl p-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        </div>

        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}