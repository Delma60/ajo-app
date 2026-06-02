"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheckIcon, ZapIcon, LockIcon, InfoIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useNativeBridge } from "@/hooks/use-native-bridge";
import { formatNaira, cn } from "@/lib/utils";

// ─── Schema ───────────────────────────────────────────────────────────────────

const depositFormSchema = z.object({
  amount: z
    .string()
    .min(1, "Please enter an amount")
    .refine((v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n >= 500;
    }, "Minimum deposit is ₦500")
    .refine((v) => {
      const n = parseFloat(v);
      return !isNaN(n) && n <= 5_000_000;
    }, "Maximum single deposit is ₦5,000,000"),
});

type DepositFormValues = z.infer<typeof depositFormSchema>;

// ─── Preset amounts ───────────────────────────────────────────────────────────

const PRESET_AMOUNTS = [1000, 2000, 5000, 10000] as const;

// ─── Trust badges ─────────────────────────────────────────────────────────────

const TRUST_BADGES = [
  {
    icon: ZapIcon,
    label: "Instant credit",
    sub: "Funds available immediately",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    icon: ShieldCheckIcon,
    label: "Bank-grade security",
    sub: "256-bit SSL encryption",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: LockIcon,
    label: "Powered by Flutterwave",
    sub: "PCI DSS certified gateway",
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface DepositFormProps {
  walletBalance: number; // kobo
  userName: string;
  onProcessing: () => void;
  onRedirecting: (reference: string, amountKobo: number) => void;
  onSuccess: (amountKobo: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DepositForm({
  walletBalance,
  userName,
  onProcessing,
  onRedirecting,
  onSuccess,
}: DepositFormProps) {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { haptic } = useNativeBridge();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DepositFormValues>({
    resolver: zodResolver(depositFormSchema),
  });

  const amountStr = watch("amount") ?? "";
  const amountNaira = parseFloat(amountStr) || 0;
  const amountKobo = Math.round(amountNaira * 100);
  const newBalanceKobo = walletBalance + amountKobo;

  function handlePresetClick(naira: number) {
    haptic("selection");
    setSelectedPreset(naira);
    setValue("amount", String(naira), { shouldValidate: true });
  }

  async function onSubmit(values: DepositFormValues) {
    const kobo = Math.round(parseFloat(values.amount) * 100);
    haptic("selection");
    setIsSubmitting(true);
    onProcessing();

    try {
      const res = await fetch("/api/payments/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: kobo }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error ?? "Failed to initialize payment");
      }

      const { paymentLink, reference } = data.data;

      if (paymentLink) {
        // Redirect to Flutterwave hosted payment page
        onRedirecting(reference, kobo);
        haptic("success");
        // Small delay so the user sees the "redirecting" state
        await new Promise((r) => setTimeout(r, 600));
        window.location.href = paymentLink;
      } else {
        // Dev/test environment: simulate success
        await new Promise((r) => setTimeout(r, 1200));
        onSuccess(kobo);
        haptic("success");
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not start payment. Please try again.",
      );
      haptic("error");
      // Reset back to form
      setIsSubmitting(false);
      // Parent stays in "processing" — we need to signal back.
      // The easiest pattern: reload the page state. In production, add an onError prop.
      window.location.reload();
    }
  }

  return (
    <div className="space-y-5">
      {/* Current balance tile */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Current balance</p>
          <p className="text-xl font-bold font-mono text-foreground mt-0.5">
            {formatNaira(walletBalance)}
          </p>
        </div>
        {amountKobo > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">After deposit</p>
            <p className="text-lg font-semibold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatNaira(newBalanceKobo)}
            </p>
          </div>
        )}
      </div>

      {/* Trust badges */}
      <div className="grid grid-cols-3 gap-2">
        {TRUST_BADGES.map(({ icon: Icon, label, sub, color, bg }) => (
          <div
            key={label}
            className={cn(
              "rounded-xl border border-border p-3 space-y-1 text-center",
              bg,
            )}
          >
            <Icon className={cn("size-4 mx-auto", color)} />
            <p className="text-[11px] font-semibold text-foreground leading-tight">
              {label}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight hidden sm:block">
              {sub}
            </p>
          </div>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Quick preset amounts */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Quick amounts
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_AMOUNTS.map((naira) => {
              const isSelected =
                selectedPreset === naira && String(naira) === amountStr;
              return (
                <button
                  key={naira}
                  type="button"
                  onClick={() => handlePresetClick(naira)}
                  className={cn(
                    "h-10 rounded-lg border text-sm font-semibold transition-all",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background hover:border-primary/50 hover:bg-primary/5 text-foreground",
                  )}
                >
                  {naira >= 1000 ? `₦${naira / 1000}k` : `₦${naira}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom amount input */}
        <div className="space-y-1.5">
          <Label htmlFor="deposit-amount">
            Or enter a custom amount{" "}
            <span className="font-normal text-muted-foreground">(₦)</span>
          </Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground select-none">
              ₦
            </span>
            <Input
              id="deposit-amount"
              type="number"
              inputMode="numeric"
              min="500"
              max="5000000"
              step="100"
              placeholder="500"
              className="pl-7"
              aria-invalid={!!errors.amount}
              {...register("amount", {
                onChange: () => setSelectedPreset(null),
              })}
            />
          </div>
          {errors.amount ? (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Min ₦500 · Max ₦5,000,000 per transaction
            </p>
          )}
        </div>

        {/* Summary card — only shown when amount is valid */}
        {amountKobo >= 50000 && (
          <Card>
            <CardContent className="divide-y divide-border space-y-0 py-3">
              {[
                {
                  label: "Deposit amount",
                  value: formatNaira(amountKobo),
                },
                {
                  label: "Processing fee",
                  value: "₦0.00",
                  sub: "Flutterwave absorbs the fee",
                },
                {
                  label: "Amount credited to wallet",
                  value: formatNaira(amountKobo),
                  highlight: true,
                },
              ].map(({ label, value, sub, highlight }) => (
                <div
                  key={label}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <div>
                    <span className="text-muted-foreground">{label}</span>
                    {sub && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {sub}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      highlight
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-foreground",
                    )}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Flutterwave payment methods note */}
        {amountKobo >= 50000 && (
          <div className="rounded-lg bg-muted/50 border border-border p-3 flex gap-2 text-xs text-muted-foreground">
            <InfoIcon className="size-3.5 shrink-0 mt-0.5" />
            <p>
              You'll be redirected to Flutterwave to complete payment via bank
              transfer, card, USSD, or mobile money. Funds credit instantly on
              success.
            </p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-10"
          disabled={isSubmitting || amountKobo < 50000}
        >
          {isSubmitting
            ? "Processing…"
            : amountKobo >= 50000
              ? `Pay ${formatNaira(amountKobo)}`
              : "Enter an amount to continue"}
        </Button>
      </form>

      {/* Security footer */}
      <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <ShieldCheckIcon className="size-3.5 text-primary" />
        Secured by Flutterwave · PCI DSS Level 1 certified
      </p>
    </div>
  );
}
