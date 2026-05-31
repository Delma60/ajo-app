"use client";

import Link from "next/link";
import { WalletIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNaira } from "@/lib/utils";

interface InvestmentWalletBannerProps {
  walletBalance: number; // kobo
  isLoading: boolean;
}

export function InvestmentWalletBanner({
  walletBalance,
  isLoading,
}: InvestmentWalletBannerProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 border border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-background border border-border shrink-0">
          <WalletIcon className="size-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Available to invest</p>
          {isLoading ? (
            <Skeleton className="h-5 w-24 mt-0.5" />
          ) : (
            <p className="text-sm font-semibold font-mono">
              {formatNaira(walletBalance)}
            </p>
          )}
        </div>
      </div>

      {!isLoading && walletBalance < 500_000 && (
        <Button size="sm" variant="outline" asChild className="shrink-0">
          <Link href="/wallet/deposit">
            Fund Wallet
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </Button>
      )}
    </div>
  );
}