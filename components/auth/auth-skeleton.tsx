import { Skeleton } from "@/components/ui/skeleton";

export function AuthSkeleton() {
  return (
    <div className="w-full space-y-5">
      {/* Logo / brand mark */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      </div>

      {/* Submit button */}
      <Skeleton className="h-9 w-full rounded-lg mt-2" />

      {/* Divider */}
      <div className="flex items-center gap-3 my-2">
        <Skeleton className="h-px flex-1" />
        <Skeleton className="h-3 w-8" />
        <Skeleton className="h-px flex-1" />
      </div>

      {/* Google button */}
      <Skeleton className="h-9 w-full rounded-lg" />

      {/* Footer link */}
      <div className="flex justify-center gap-2 pt-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  );
}