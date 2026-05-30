"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeftIcon,
  BuildingIcon,
  Loader2,
  InfoIcon,
  ShieldCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { useAuthStore } from "@/lib/stores/auth-store";
import { formatNaira } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BankAccount } from "@/lib/types/user";

const withdrawSchema = z.object({
  amount: z
    .string()
    .min(1, "Enter an amount")
    .refine((v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n >= 1000;
    }, "Minimum withdrawal is ₦1,000"),
  bankAccountId: z.string().min(1, "Select a bank account"),
});

type WithdrawFormValues = z.infer<typeof withdrawSchema>;

function calculateFee(amountNaira: number): number {
  const percent = Math.round(amountNaira * 100 * 0.01); // 1%
  const flat = 5000; // ₦50 in kobo
  return Math.min(percent + flat, 50000); // capped at ₦500
}

export function WithdrawContent({
  walletBalance,
}: {
  walletBalance: number; // kobo
}) {
  const router = useRouter();
  const { appUser } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WithdrawFormValues>({
    resolver: zodResolver(withdrawSchema),
    defaultValues: { bankAccountId: appUser?.bankAccounts?.find((b) => b.isDefault)?.id ?? "" },
  });

  const amountStr = watch("amount") ?? "";
  const selectedAccountId = watch("bankAccountId");
  const amountNaira = parseFloat(amountStr) || 0;
  const amountKobo = Math.round(amountNaira * 100);
  const feeKobo = calculateFee(amountNaira);
  const netKobo = amountKobo - feeKobo;
  const hasSufficientFunds = walletBalance >= amountKobo;
  const bankAccounts: BankAccount[] = appUser?.bankAccounts ?? [];

  async function onSubmit(values: WithdrawFormValues) {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/payments/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountKobo,
          bankAccountId: values.bankAccountId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Withdrawal failed");
      toast.success("Withdrawal initiated! Funds will arrive within minutes.");
      router.push("/wallet");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedAccount = bankAccounts.find((b) => b.id === selectedAccountId);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-lg mx-auto px-4 md:px-6 py-5 space-y-6">
        {/* Back */}
        <Link
          href="/wallet"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to Wallet
        </Link>

        <div>
          <h1 className="text-xl font-semibold">Withdraw Funds</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Transfer your wallet balance to your bank account.
          </p>
        </div>

        {/* Available balance */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
          <p className="text-xs text-muted-foreground">Available balance</p>
          <p className="text-2xl font-bold font-mono text-foreground mt-0.5">
            {formatNaira(walletBalance)}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {/* Bank account selection */}
          <div className="space-y-2">
            <Label>Bank account</Label>
            {bankAccounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-center space-y-2">
                <BuildingIcon className="size-6 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No bank accounts saved yet.
                </p>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/settings?tab=bank-accounts">Add bank account</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {bankAccounts.map((account) => (
                  <button
                    type="button"
                    key={account.id}
                    onClick={() => setValue("bankAccountId", account.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                      selectedAccountId === account.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <div className="flex size-9 items-center justify-center rounded-lg bg-muted shrink-0">
                      <BuildingIcon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{account.bankName}</p>
                      <p className="text-xs text-muted-foreground">
                        •••• {account.accountNumber.slice(-4)} · {account.accountName}
                      </p>
                    </div>
                    {account.isDefault && (
                      <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                        Default
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {errors.bankAccountId && (
              <p className="text-xs text-destructive">{errors.bankAccountId.message}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="withdraw-amount">Amount (₦)</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ₦
              </span>
              <Input
                id="withdraw-amount"
                type="number"
                min="1000"
                step="100"
                placeholder="1000"
                className="pl-7"
                aria-invalid={!!errors.amount}
                {...register("amount")}
              />
            </div>
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>

          {/* Fee breakdown */}
          {amountKobo > 0 && (
            <Card>
              <CardContent className="divide-y divide-border space-y-0 py-3">
                {[
                  { label: "Withdrawal amount", value: formatNaira(amountKobo) },
                  { label: "Fee (1% + ₦50, max ₦500)", value: `-${formatNaira(feeKobo)}` },
                  {
                    label: "You receive",
                    value: netKobo > 0 ? formatNaira(netKobo) : "—",
                    highlight: true,
                  },
                ].map(({ label, value, highlight }) => (
                  <div
                    key={label}
                    className="flex justify-between py-1.5 text-sm"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span
                      className={cn(
                        "font-mono font-semibold",
                        highlight ? "text-primary" : "text-foreground"
                      )}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Destination confirmation */}
          {selectedAccount && amountKobo > 0 && (
            <div className="rounded-lg bg-muted/50 border border-border p-3 flex gap-2 text-xs">
              <InfoIcon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-foreground/80">
                {formatNaira(netKobo)} will be sent to{" "}
                <strong>{selectedAccount.bankName}</strong> ····{" "}
                {selectedAccount.accountNumber.slice(-4)}. A fee of{" "}
                <strong>{formatNaira(feeKobo)}</strong> will be deducted.
              </p>
            </div>
          )}

          {!hasSufficientFunds && amountKobo > 0 && (
            <p className="text-xs text-destructive">
              Insufficient balance. You have {formatNaira(walletBalance)} available.
            </p>
          )}

          {/* Security note */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-3.5 text-primary" />
            Secured by Flutterwave. Funds typically arrive within 10 minutes.
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={
              isSubmitting ||
              !hasSufficientFunds ||
              !selectedAccountId ||
              bankAccounts.length === 0
            }
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSubmitting ? "Processing…" : `Withdraw ${amountKobo > 0 ? formatNaira(amountKobo) : ""}`}
          </Button>
        </form>
      </div>
    </div>
  );
}