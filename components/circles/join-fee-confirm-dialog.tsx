"use client";

import { WalletIcon, TicketIcon, CalendarClockIcon, CheckCircle2Icon } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface JoinFeeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Circle name shown in the dialog heading */
  circleName: string;
  /** Join fee in kobo */
  joinFeeKobo: number;
  /** When the fee is collected */
  joinFeeType: "before_joining" | "first_contribution";
  /** User's current wallet balance in kobo — used to warn if insufficient */
  walletBalance?: number;
  /** Called when the user confirms they want to proceed */
  onConfirm: () => void;
  /** Whether the join request is in-flight */
  isLoading?: boolean;
}

export function JoinFeeConfirmDialog({
  open,
  onOpenChange,
  circleName,
  joinFeeKobo,
  joinFeeType,
  walletBalance,
  onConfirm,
  isLoading,
}: JoinFeeConfirmDialogProps) {
  const isBeforeJoining = joinFeeType === "before_joining";
  const hasInsufficientFunds =
    isBeforeJoining &&
    walletBalance !== undefined &&
    walletBalance < joinFeeKobo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <TicketIcon className="size-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="leading-tight">Join fee required</DialogTitle>
              <DialogDescription className="mt-0.5">
                {circleName} charges a one-time fee to join.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Fee amount highlight */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              One-time join fee
            </p>
            <p className="text-3xl font-black font-mono text-primary tracking-tight">
              {formatNaira(joinFeeKobo)}
            </p>
            <p className="text-xs text-muted-foreground">
              paid once, not per cycle
            </p>
          </div>

          {/* Collection timing */}
          <div
            className={cn(
              "rounded-lg border p-3 flex items-start gap-2.5 text-xs",
              isBeforeJoining
                ? "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30"
                : "bg-muted/50 border-border",
            )}
          >
            {isBeforeJoining ? (
              <WalletIcon className="size-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <CalendarClockIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <p
                className={cn(
                  "font-semibold",
                  isBeforeJoining
                    ? "text-amber-800 dark:text-amber-400"
                    : "text-foreground",
                )}
              >
                {isBeforeJoining
                  ? "Deducted immediately on joining"
                  : "Collected with your first contribution"}
              </p>
              <p
                className={cn(
                  isBeforeJoining
                    ? "text-amber-700 dark:text-amber-500"
                    : "text-muted-foreground",
                )}
              >
                {isBeforeJoining
                  ? "The fee will be taken from your wallet the moment you join. Make sure your wallet has sufficient funds."
                  : "You won't be charged now. The fee will be bundled with your first contribution payment."}
              </p>
            </div>
          </div>

          {/* Wallet balance row — only relevant for before_joining */}
          {isBeforeJoining && walletBalance !== undefined && (
            <div
              className={cn(
                "rounded-lg border p-3 flex items-center justify-between text-xs",
                hasInsufficientFunds
                  ? "bg-destructive/5 border-destructive/20"
                  : "bg-muted/50 border-border",
              )}
            >
              <span className="text-muted-foreground flex items-center gap-1.5">
                <WalletIcon className="size-3.5" />
                Your wallet balance
              </span>
              <span
                className={cn(
                  "font-mono font-semibold",
                  hasInsufficientFunds
                    ? "text-destructive"
                    : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {formatNaira(walletBalance)}
              </span>
            </div>
          )}

          {/* Insufficient funds warning */}
          {hasInsufficientFunds && (
            <p className="text-xs text-destructive px-1">
              Your wallet balance is too low to cover this fee. Please{" "}
              <a
                href="/wallet/deposit"
                className="underline underline-offset-2 font-medium"
              >
                fund your wallet
              </a>{" "}
              before joining.
            </p>
          )}

          {/* What you get */}
          <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">What happens next</p>
            <div className="flex items-start gap-2">
              <CheckCircle2Icon className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>You become a full member of {circleName}</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2Icon className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                {isBeforeJoining
                  ? `${formatNaira(joinFeeKobo)} is credited to the circle admin's wallet`
                  : `${formatNaira(joinFeeKobo)} will be charged alongside your first contribution`}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2Icon className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>This fee does not count towards your contribution</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || hasInsufficientFunds}
            className="flex-1"
          >
            {isLoading ? "Joining…" : `Pay ${formatNaira(joinFeeKobo)} & Join`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}