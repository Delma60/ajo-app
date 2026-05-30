"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, GavelIcon, InfoIcon } from "lucide-react";
import { toast } from "sonner";
import { usePlaceBid } from "@/lib/hooks/use-circle";
import { formatNaira } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const bidSchema = z.object({
  amount: z
    .string()
    .min(1, "Enter a bid amount")
    .refine((v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n > 0;
    }, "Bid must be greater than 0"),
});

type BidFormValues = z.infer<typeof bidSchema>;

interface BidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circleId: string;
  circleName: string;
  poolAmount: number; // kobo — the base payout pool
  deadline: Date;
}

export function BidDialog({
  open,
  onOpenChange,
  circleId,
  circleName,
  poolAmount,
  deadline,
}: BidDialogProps) {
  const placeBid = usePlaceBid();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BidFormValues>({ resolver: zodResolver(bidSchema) });

  const bidAmountNum = parseFloat(watch("amount") ?? "0") || 0;
  const bidAmountKobo = Math.round(bidAmountNum * 100);
  const totalIfWon = poolAmount; // winner receives full pool (premium goes back to others)

  async function onSubmit(values: BidFormValues) {
    try {
      await placeBid.mutateAsync({
        circleId,
        amount: Math.round(parseFloat(values.amount) * 100),
      });
      toast.success(
        "Bid placed! You'll be notified when bidding closes."
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bid failed. Try again.");
    }
  }

  const deadlineStr = new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(deadline);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <GavelIcon className="size-4 text-primary" />
            </div>
            <DialogTitle>Place a Bid</DialogTitle>
          </div>
          <DialogDescription>
            Bid to receive the <strong>{circleName}</strong> payout early.
            The highest bidder wins.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 py-1">
          {/* Info */}
          <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Pool payout</span>
              <span className="font-mono font-semibold text-foreground">
                {formatNaira(poolAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Bidding closes</span>
              <span className="font-medium text-foreground">{deadlineStr}</span>
            </div>
          </div>

          {/* Bid amount */}
          <div className="space-y-1.5">
            <Label htmlFor="bid-amount">Your bid premium (₦)</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ₦
              </span>
              <Input
                id="bid-amount"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                className="pl-7"
                aria-invalid={!!errors.amount}
                {...register("amount")}
              />
            </div>
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              This premium is in addition to your regular contribution. It goes
              to non-winning members.
            </p>
          </div>

          {/* Advisory */}
          {bidAmountKobo > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex gap-2 text-xs">
              <InfoIcon className="size-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-foreground/80">
                If you win, you pay{" "}
                <strong>{formatNaira(bidAmountKobo)}</strong> extra on top of
                your regular contribution and receive{" "}
                <strong>{formatNaira(totalIfWon)}</strong> from the pool.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={placeBid.isPending}>
              {placeBid.isPending && <Loader2 className="size-4 animate-spin" />}
              {placeBid.isPending ? "Placing bid…" : "Place bid"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}