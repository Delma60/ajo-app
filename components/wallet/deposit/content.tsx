"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { DepositForm } from "@/components/wallet/deposit/form";
import { DepositSuccess } from "@/components/wallet/deposit/success";
import { DepositProcessing } from "@/components/wallet/deposit/processing";

export type DepositFlowState =
  | { stage: "form" }
  | { stage: "processing" }
  | { stage: "redirecting"; reference: string; amountKobo: number }
  | { stage: "success"; amountKobo: number };

interface DepositContentProps {
  walletBalance: number; // kobo
  userName: string;
}

export function DepositContent({ walletBalance, userName }: DepositContentProps) {
  const [flow, setFlow] = useState<DepositFlowState>({ stage: "form" });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-lg mx-auto px-4 md:px-6 py-5 space-y-6">
        {/* Back navigation */}
        <Link
          href="/wallet"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to Wallet
        </Link>

        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold">Fund Your Wallet</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add money securely via Flutterwave — instant credit to your balance.
          </p>
        </div>

        {/* Flow stages */}
        {flow.stage === "form" && (
          <DepositForm
            walletBalance={walletBalance}
            userName={userName}
            onProcessing={() => setFlow({ stage: "processing" })}
            onRedirecting={(reference, amountKobo) =>
              setFlow({ stage: "redirecting", reference, amountKobo })
            }
            onSuccess={(amountKobo) =>
              setFlow({ stage: "success", amountKobo })
            }
          />
        )}

        {flow.stage === "processing" && <DepositProcessing />}

        {flow.stage === "redirecting" && (
          <DepositProcessing
            message="Redirecting to secure payment page…"
            subMessage="You'll be returned here once payment is complete."
          />
        )}

        {flow.stage === "success" && (
          <DepositSuccess amountKobo={flow.amountKobo} />
        )}
      </div>
    </div>
  );
}