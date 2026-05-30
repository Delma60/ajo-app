"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2Icon,
  XCircleIcon,
  Loader2,
  AlertTriangleIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/utils";

type VerifyState =
  | { stage: "verifying" }
  | { stage: "success"; amountKobo: number }
  | { stage: "cancelled" }
  | { stage: "failed"; message: string }
  | { stage: "pending" };

interface DepositCallbackContentProps {
  status: string;
  txRef: string;
  transactionId: string;
}

export function DepositCallbackContent({
  status,
  txRef,
  transactionId,
}: DepositCallbackContentProps) {
  const [state, setState] = useState<VerifyState>(() => {
    // Handle obvious cancelled/failed states immediately without a network call
    if (status === "cancelled") return { stage: "cancelled" };
    if (status === "failed") return { stage: "failed", message: "Payment was declined by your bank." };
    return { stage: "verifying" };
  });

  useEffect(() => {
    if (state.stage !== "verifying") return;

    async function verifyPayment() {
      try {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txRef, transactionId }),
        });
        const data = await res.json();

        if (!data.success) {
          // If webhook already processed it, the tx will be success in our DB
          if (data.error?.includes("already processed")) {
            setState({ stage: "success", amountKobo: data.data?.amount ?? 0 });
          } else {
            setState({ stage: "pending", });
          }
          return;
        }

        setState({ stage: "success", amountKobo: data.data?.amount ?? 0 });
      } catch {
        // Network error — transaction may still be processing via webhook
        setState({ stage: "pending" });
      }
    }

    verifyPayment();
  }, [state.stage, txRef, transactionId]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-sm mx-auto px-4 py-16 flex flex-col items-center text-center space-y-6">
        {state.stage === "verifying" && (
          <>
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="size-7 text-primary animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Confirming your payment…</p>
              <p className="text-sm text-muted-foreground">
                This usually takes just a moment.
              </p>
            </div>
          </>
        )}

        {state.stage === "success" && (
          <>
            <div className="size-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center ring-4 ring-emerald-50 dark:ring-emerald-900/10">
              <CheckCircle2Icon className="size-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold">Payment Confirmed!</h1>
              {state.amountKobo > 0 && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground font-mono">
                    {formatNaira(state.amountKobo)}
                  </span>{" "}
                  has been credited to your wallet.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Button asChild className="w-full">
                <Link href="/wallet">View My Wallet</Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/circles">Browse Circles</Link>
              </Button>
            </div>
          </>
        )}

        {state.stage === "cancelled" && (
          <>
            <div className="size-16 rounded-full bg-muted flex items-center justify-center">
              <XCircleIcon className="size-8 text-muted-foreground" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold">Payment Cancelled</h1>
              <p className="text-sm text-muted-foreground">
                You cancelled the payment. No money was deducted from your account.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Button asChild className="w-full">
                <Link href="/wallet/deposit">Try Again</Link>
              </Button>
              <Button variant="ghost" asChild className="w-full text-muted-foreground">
                <Link href="/wallet">Back to Wallet</Link>
              </Button>
            </div>
          </>
        )}

        {state.stage === "failed" && (
          <>
            <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircleIcon className="size-8 text-destructive" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold">Payment Failed</h1>
              <p className="text-sm text-muted-foreground">
                {state.message}
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Button asChild className="w-full">
                <Link href="/wallet/deposit">Try Again</Link>
              </Button>
              <Button variant="ghost" asChild className="w-full text-muted-foreground">
                <Link href="/wallet">Back to Wallet</Link>
              </Button>
            </div>
          </>
        )}

        {state.stage === "pending" && (
          <>
            <div className="size-16 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <AlertTriangleIcon className="size-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold">Payment Pending</h1>
              <p className="text-sm text-muted-foreground">
                Your payment is being processed. If you were charged, your wallet
                balance will update within a few minutes.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Button asChild className="w-full">
                <Link href="/wallet">
                  <RefreshCwIcon className="size-4" />
                  Check Wallet Balance
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => setState({ stage: "verifying" })}
              >
                Re-check Status
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}