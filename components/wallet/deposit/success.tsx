"use client";

import Link from "next/link";
import { CheckCircle2Icon, ArrowRightIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/utils";

interface DepositSuccessProps {
  amountKobo: number;
}

export function DepositSuccess({ amountKobo }: DepositSuccessProps) {
  return (
    <div className="flex flex-col items-center text-center py-10 space-y-6">
      {/* Icon */}
      <div className="size-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center ring-4 ring-emerald-100 dark:ring-emerald-900/20">
        <CheckCircle2Icon className="size-10 text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Message */}
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold">Payment Successful!</h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground font-mono">
            {formatNaira(amountKobo)}
          </span>{" "}
          has been added to your AjoSave wallet.
        </p>
      </div>

      {/* What's next */}
      <div className="w-full rounded-xl bg-muted/50 border border-border p-4 text-left space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          What's next?
        </p>
        <div className="space-y-2.5">
          {[
            {
              icon: WalletIcon,
              label: "View your updated balance",
              href: "/wallet",
            },
            {
              icon: ArrowRightIcon,
              label: "Join or contribute to a circle",
              href: "/circles",
            },
          ].map(({ icon: Icon, label, href }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 text-sm text-foreground hover:text-primary transition-colors group"
            >
              <div className="flex size-7 items-center justify-center rounded-lg bg-background border border-border group-hover:border-primary/40 transition-colors">
                <Icon className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              {label}
              <ArrowRightIcon className="size-3 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-2 w-full">
        <Button asChild className="w-full">
          <Link href="/wallet">Go to My Wallet</Link>
        </Button>
        <Button variant="ghost" asChild className="w-full text-muted-foreground">
          <Link href="/circles">Browse Circles</Link>
        </Button>
      </div>
    </div>
  );
}