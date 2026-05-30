"use client";

import { useState } from "react";
import { Eye, EyeOff, ArrowDownToLine, ArrowUpFromLine, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Wallet } from "@/lib/types/wallet";
import Link from "next/link";

interface BalanceCardProps {
  wallet: Wallet | null;
  isLoading?: boolean;
}

export function BalanceCard({ wallet, isLoading }: BalanceCardProps) {
  const [hidden, setHidden] = useState(false);

  if (isLoading) {
    return <BalanceCardSkeleton />;
  }

  const available = wallet?.available ?? 0;
  const pending = wallet?.pending ?? 0;

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden p-5 text-white",
        "bg-[#047857]"
      )}
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top right, rgba(255,255,255,0.12) 0%, transparent 60%), radial-gradient(ellipse at bottom left, rgba(0,0,0,0.2) 0%, transparent 60%)",
      }}
    >
      {/* Decorative rings */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full border border-white/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -right-8 size-28 rounded-full border border-white/10"
      />

      {/* Top row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
          Available Balance
        </span>
        <button
          onClick={() => setHidden((v) => !v)}
          className="p-1 rounded-full hover:bg-white/10 transition-colors"
          aria-label={hidden ? "Show balance" : "Hide balance"}
        >
          {hidden ? (
            <EyeOff className="size-4 text-white/70" />
          ) : (
            <Eye className="size-4 text-white/70" />
          )}
        </button>
      </div>

      {/* Amount */}
      <div className="mb-1">
        <span className="text-3xl font-bold tracking-tight font-mono">
          {hidden ? "₦ ••••••" : formatNaira(available)}
        </span>
      </div>

      {/* Pending */}
      {pending > 0 && (
        <p className="text-xs text-white/60 mb-5">
          {formatNaira(pending)} pending
        </p>
      )}
      {pending === 0 && <div className="mb-5" />}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          asChild
          className="flex-1 bg-white/15 hover:bg-white/25 text-white border-0 h-9 text-xs font-medium rounded-xl"
        >
          <Link href="/wallet">
            <Plus className="size-3.5" />
            Fund Wallet
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          asChild
          className="flex-1 bg-white/15 hover:bg-white/25 text-white border-0 h-9 text-xs font-medium rounded-xl"
        >
          <Link href="/wallet/withdraw">
            <ArrowUpFromLine className="size-3.5" />
            Withdraw
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function BalanceCardSkeleton() {
  return (
    <div className="rounded-2xl bg-muted animate-pulse h-[172px]" />
  );
}