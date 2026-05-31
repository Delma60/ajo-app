"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { PackageCard } from "@/components/investments/package-card";
import { INVESTMENT_PACKAGES, type InvestmentPackage } from "@/lib/types/investment";

interface InvestmentPackagesGridProps {
  walletBalance: number; // kobo
  onSelectPackage: (pkg: InvestmentPackage) => void;
  isLoadingWallet: boolean;
}

function PackageCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-2">
        <Skeleton className="size-5 rounded" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
      {/* Yield + Duration + Risk row */}
      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="h-8 w-px" />
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-14" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-8 w-px" />
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      {/* Example return */}
      <Skeleton className="h-16 rounded-lg" />
      {/* Features */}
      <div className="space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="size-3 rounded" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="space-y-1">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-7 w-28 rounded-md" />
      </div>
    </div>
  );
}

export function InvestmentPackagesGrid({
  walletBalance,
  onSelectPackage,
  isLoadingWallet,
}: InvestmentPackagesGridProps) {
  const activePackages = INVESTMENT_PACKAGES.filter((p) => p.isActive);

  return (
    <section id="packages" className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Available Packages</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose a plan that matches your risk appetite and timeline.
          </p>
        </div>
        <p className="text-xs text-muted-foreground shrink-0">
          {activePackages.length} package{activePackages.length !== 1 ? "s" : ""} available
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isLoadingWallet
          ? Array.from({ length: 4 }).map((_, i) => (
              <PackageCardSkeleton key={i} />
            ))
          : activePackages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                walletBalance={walletBalance}
                onSelect={onSelectPackage}
              />
            ))}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        Returns are calculated based on stated annual rates and lock period.
        Past performance does not guarantee future results.
      </p>
    </section>
  );
}