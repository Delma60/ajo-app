"use client";

import { useState } from "react";
import { Loader2, WalletIcon, CheckCircle2Icon } from "lucide-react";
import { toast } from "sonner";
import { useContribute } from "@/lib/hooks/use-circle";
import { formatNaira } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circleId: string;
  circleName: string;
  amount: number; // kobo
  walletBalance: number; // kobo
}

export function ContributionDialog({
  open,
  onOpenChange,
  circleId,
  circleName,
  amount,
  walletBalance,
}: ContributionDialogProps) {
  const contribute = useContribute();
  const [done, setDone] = useState(false);
  const hasSufficientFunds = walletBalance >= amount;

  async function handleContribute() {
    try {
      await contribute.mutateAsync({ circleId, amount });
      setDone(true);
      setTimeout(() => {
        setDone(false);
        onOpenChange(false);
      }, 1800);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Contribution failed. Try again."
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        {done ? (
          <div className="flex flex-col items-center py-6 gap-4 text-center">
            <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2Icon className="size-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Contribution confirmed!</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatNaira(amount)} has been sent to {circleName}.
              </p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Make Contribution</DialogTitle>
              <DialogDescription>
                Contribute to <strong>{circleName}</strong> for this cycle.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Amount summary */}
              <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount due</span>
                  <span className="font-mono font-semibold">{formatNaira(amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Wallet balance</span>
                  <span
                    className={
                      hasSufficientFunds
                        ? "font-mono font-semibold text-emerald-600"
                        : "font-mono font-semibold text-destructive"
                    }
                  >
                    {formatNaira(walletBalance)}
                  </span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Balance after</span>
                  <span className="font-mono font-semibold">
                    {hasSufficientFunds
                      ? formatNaira(walletBalance - amount)
                      : "—"}
                  </span>
                </div>
              </div>

              {!hasSufficientFunds && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-xs text-destructive flex gap-2">
                  <WalletIcon className="size-4 shrink-0" />
                  Insufficient wallet balance. Please fund your wallet first.
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleContribute}
                disabled={!hasSufficientFunds || contribute.isPending}
              >
                {contribute.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {contribute.isPending ? "Processing…" : `Pay ${formatNaira(amount)}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}