"use client";

import Link from "next/link";
import { PiggyBankIcon, TrendingUpIcon, ShieldCheckIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvestmentEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 px-6 text-center space-y-6">
      {/* Icon cluster */}
      <div className="relative flex items-center justify-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
          <PiggyBankIcon className="size-8 text-primary" />
        </div>
        <div className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 border-2 border-background">
          <TrendingUpIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
      </div>

      {/* Copy */}
      <div className="space-y-2 max-w-xs">
        <h3 className="text-base font-semibold">No active investments yet</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Put your idle wallet balance to work. Choose a package below and start
          earning fixed returns today.
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm text-xs text-muted-foreground">
        {[
          { icon: "🏛️", label: "Government-backed T-Bills" },
          { icon: "🔒", label: "Fixed, guaranteed yields" },
          { icon: "📈", label: "Up to 31% p.a." },
        ].map(({ icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-xl bg-muted/40 border border-border p-3"
          >
            <span className="text-base">{icon}</span>
            <p className="text-center leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border p-3 max-w-sm text-left">
        <ShieldCheckIcon className="size-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Investments are not savings. Returns are not guaranteed beyond the
          stated fixed rate. Funds are locked for the selected duration.
        </p>
      </div>

      <Button asChild>
        <a href="#packages">
          <ArrowRightIcon className="size-4" />
          Browse packages
        </a>
      </Button>
    </div>
  );
}