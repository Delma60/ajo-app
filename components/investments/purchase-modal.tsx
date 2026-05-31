"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  CheckCircle2Icon,
  WalletIcon,
  TrendingUpIcon,
  LockIcon,
  InfoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatNaira, cn } from "@/lib/utils";
import {
  RISK_META,
  CATEGORY_META,
  type InvestmentPackage,
} from "@/lib/types/investment";
import { useCreateInvestment } from "@/lib/hooks/use-investments";

// ─── Preset amounts ────────────────────────────────────────────────────────────

const PRESET_AMOUNTS_KOBO = [
  500_000, // ₦5,000
  1_000_000, // ₦10,000
  5_000_000, // ₦50,000
  10_000_000, // ₦100,000
];

// ─── Schema ───────────────────────────────────────────────────────────────────

function buildSchema(pkg: InvestmentPackage) {
  return z.object({
    amount: z
      .string()
      .min(1, "Enter an amount")
      .refine((v) => {
        const n = parseFloat(v);
        return !isNaN(n) && n > 0;
      }, "Must be a positive number")
      .refine((v) => {
        const kobo = Math.round(parseFloat(v) * 100);
        return kobo >= pkg.minAmountKobo;
      }, `Minimum is ₦${(pkg.minAmountKobo / 100).toLocaleString()}`)
      .refine((v) => {
        const kobo = Math.round(parseFloat(v) * 100);
        return kobo <= pkg.maxAmountKobo;
      }, `Maximum is ₦${(pkg.maxAmountKobo / 100).toLocaleString()}`),
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg: InvestmentPackage | null;
  walletBalance: number; // kobo
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PurchaseModal({
  open,
  onOpenChange,
  pkg,
  walletBalance,
}: PurchaseModalProps) {
  const createInvestment = useCreateInvestment();
  const [done, setDone] = useState(false);
  const [confirmedAmount, setConfirmedAmount] = useState(0);

  const schema = pkg ? buildSchema(pkg) : z.object({ amount: z.string() });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<{ amount: string }>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "" },
  });

  const amountStr = watch("amount") ?? "";
  const amountNaira = parseFloat(amountStr) || 0;
  const amountKobo = Math.round(amountNaira * 100);

  const interestKobo = pkg
    ? Math.round(
        (amountKobo * (pkg.annualYieldPercent / 100) * pkg.durationDays) / 365
      )
    : 0;
  const expectedReturnKobo = amountKobo + interestKobo;
  const balanceAfterKobo = walletBalance - amountKobo;
  const hasSufficientFunds = walletBalance >= amountKobo && amountKobo > 0;

  function handleClose() {
    if (createInvestment.isPending) return;
    reset();
    setDone(false);
    onOpenChange(false);
  }

  async function onSubmit(values: { amount: string }) {
    if (!pkg) return;
    const kobo = Math.round(parseFloat(values.amount) * 100);

    try {
      await createInvestment.mutateAsync({ packageId: pkg.id, principalKobo: kobo });
      setConfirmedAmount(kobo);
      setDone(true);
      setTimeout(() => {
        handleClose();
      }, 2500);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Investment failed. Try again."
      );
    }
  }

  if (!pkg) return null;

  const riskMeta = RISK_META[pkg.riskLevel];
  const categoryMeta = CATEGORY_META[pkg.category];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        {done ? (
          <div className="flex flex-col items-center py-6 gap-4 text-center">
            <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2Icon className="size-7 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Investment confirmed!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatNaira(confirmedAmount)} invested in {pkg.name}. Your funds
                are now locked for {pkg.durationDays} days.
              </p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{categoryMeta.icon}</span>
                <DialogTitle>{pkg.name}</DialogTitle>
              </div>
              <DialogDescription>
                {pkg.annualYieldPercent}% p.a. · {pkg.durationDays}-day lock period
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="space-y-4 py-1"
            >
              {/* Preset amounts */}
              <div className="space-y-2">
                <Label>Quick amounts</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESET_AMOUNTS_KOBO.filter(
                    (a) => a >= pkg.minAmountKobo && a <= pkg.maxAmountKobo
                  ).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setValue("amount", String(preset / 100), {
                          shouldValidate: true,
                        })
                      }
                      className={cn(
                        "h-8 rounded-lg border text-xs font-medium transition-all",
                        amountKobo === preset
                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                          : "border-border hover:border-primary/40 text-muted-foreground"
                      )}
                    >
                      {formatNaira(preset, true)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom amount input */}
              <div className="space-y-1.5">
                <Label htmlFor="invest-amount">Amount (₦)</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₦
                  </span>
                  <Input
                    id="invest-amount"
                    type="number"
                    min={pkg.minAmountKobo / 100}
                    step="100"
                    placeholder={String(pkg.minAmountKobo / 100)}
                    className="pl-7"
                    aria-invalid={!!errors.amount}
                    {...register("amount")}
                  />
                </div>
                {errors.amount && (
                  <p className="text-xs text-destructive">
                    {errors.amount.message}
                  </p>
                )}
              </div>

              {/* Summary */}
              {amountKobo > 0 && (
                <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">You invest</span>
                    <span className="font-mono font-semibold">
                      {formatNaira(amountKobo)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Interest ({pkg.annualYieldPercent}% × {pkg.durationDays}d)
                    </span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatNaira(interestKobo)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-medium">You receive at maturity</span>
                    <span className="font-mono font-bold text-primary">
                      {formatNaira(expectedReturnKobo)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Wallet balance after
                    </span>
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        hasSufficientFunds
                          ? "text-foreground"
                          : "text-destructive"
                      )}
                    >
                      {hasSufficientFunds
                        ? formatNaira(balanceAfterKobo)
                        : "Insufficient"}
                    </span>
                  </div>
                </div>
              )}

              {/* Risk notice */}
              <div className="flex items-start gap-2 rounded-lg bg-muted/30 border border-border p-2.5 text-xs text-muted-foreground">
                <InfoIcon className="size-3.5 shrink-0 mt-0.5" />
                <p>
                  Funds are locked for {pkg.durationDays} days. Early withdrawal
                  is not permitted.{" "}
                  <span
                    className={cn(
                      "font-medium",
                      riskMeta.badgeCls
                        .split(" ")
                        .filter((c) => c.startsWith("text-"))
                        .join(" ")
                    )}
                  >
                    {riskMeta.label}
                  </span>
                </p>
              </div>

              {/* Wallet balance */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <WalletIcon className="size-3.5" />
                Wallet balance: {formatNaira(walletBalance)}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={createInvestment.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !hasSufficientFunds ||
                    amountKobo === 0 ||
                    createInvestment.isPending
                  }
                >
                  {createInvestment.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LockIcon className="size-4" />
                  )}
                  {createInvestment.isPending
                    ? "Investing…"
                    : `Invest ${amountKobo > 0 ? formatNaira(amountKobo) : ""}`}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}