"use client";

import { TrendingUpIcon, ClockIcon, LockIcon, CheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNaira, cn } from "@/lib/utils";
import {
  RISK_META,
  CATEGORY_META,
  type InvestmentPackage,
} from "@/lib/types/investment";

interface PackageCardProps {
  pkg: InvestmentPackage;
  onSelect: (pkg: InvestmentPackage) => void;
  walletBalance: number; // kobo
}

export function PackageCard({ pkg, onSelect, walletBalance }: PackageCardProps) {
  const riskMeta = RISK_META[pkg.riskLevel];
  const categoryMeta = CATEGORY_META[pkg.category];
  const canAfford = walletBalance >= pkg.minAmountKobo;

  // Compute what ₦10,000 example earns
  const examplePrincipalKobo = 1_000_000; // ₦10,000
  const exampleInterest = Math.round(
    (examplePrincipalKobo *
      (pkg.annualYieldPercent / 100) *
      pkg.durationDays) /
      365
  );

  const yieldColorCls =
    pkg.annualYieldPercent >= 28
      ? "text-emerald-600 dark:text-emerald-400"
      : pkg.annualYieldPercent >= 22
      ? "text-blue-600 dark:text-blue-400"
      : "text-foreground";

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border bg-card p-4 space-y-4 transition-all",
        "hover:border-primary/40 hover:shadow-sm hover:ring-1 hover:ring-primary/20",
        !canAfford && "opacity-60"
      )}
    >
      {/* Badge */}
      {pkg.badgeLabel && (
        <div className="absolute -top-2.5 right-3">
          <Badge className="text-[10px] h-5 px-2 shadow-sm">
            {pkg.badgeLabel}
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base">{categoryMeta.icon}</span>
            <p className="text-sm font-semibold leading-tight">{pkg.name}</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {pkg.description}
          </p>
        </div>
      </div>

      {/* Yield + Duration */}
      <div className="flex items-center gap-4">
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Annual Yield
          </p>
          <p className={cn("text-2xl font-bold font-mono leading-none", yieldColorCls)}>
            {pkg.annualYieldPercent}
            <span className="text-sm font-semibold">%</span>
          </p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Duration
          </p>
          <div className="flex items-center gap-1">
            <ClockIcon className="size-3 text-muted-foreground" />
            <p className="text-sm font-semibold">
              {pkg.durationDays >= 365
                ? "1 year"
                : pkg.durationDays >= 30
                ? `${Math.round(pkg.durationDays / 30)}mo`
                : `${pkg.durationDays}d`}
            </p>
          </div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            Risk
          </p>
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "size-1.5 rounded-full shrink-0",
                riskMeta.dotCls
              )}
            />
            <p className="text-xs font-medium">{riskMeta.label}</p>
          </div>
        </div>
      </div>

      {/* Example return */}
      <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
          Example — invest ₦10,000
        </p>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">You earn</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
            +{formatNaira(exampleInterest)}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">You receive</span>
          <span className="font-semibold font-mono">
            {formatNaira(examplePrincipalKobo + exampleInterest)}
          </span>
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-1">
        {pkg.features.slice(0, 3).map((feat) => (
          <li key={feat} className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckIcon className="size-3 text-primary shrink-0" />
            {feat}
          </li>
        ))}
      </ul>

      {/* Min amount + CTA */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
        <div>
          <p className="text-[10px] text-muted-foreground">Min. investment</p>
          <p className="text-xs font-semibold font-mono">
            {formatNaira(pkg.minAmountKobo)}
          </p>
        </div>
        <Button
          size="sm"
          disabled={!canAfford || !pkg.isActive}
          onClick={() => onSelect(pkg)}
          className="shrink-0"
        >
          <LockIcon className="size-3.5" />
          {canAfford ? "Invest Now" : "Insufficient Balance"}
        </Button>
      </div>

      {!canAfford && (
        <p className="text-[10px] text-muted-foreground text-center -mt-2">
          You need {formatNaira(pkg.minAmountKobo - walletBalance)} more in your wallet
        </p>
      )}
    </div>
  );
}