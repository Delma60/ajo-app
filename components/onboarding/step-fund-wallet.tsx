"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  ArrowLeftIcon,
  WalletIcon,
  ZapIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useNativeBridge } from "@/hooks/use-native-bridge";
import { useSettings } from "@/lib/providers/settings";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatNaira } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const MIN_DEPOSIT = 50000; // ₦500 in kobo

function buildDepositSchema(settings: any) {
  const minDepositKobo = settings.wallet.minDepositKobo;
  return z.object({
    amount: z
      .string()
      .min(1, "Enter an amount")
      .refine(
        (v) => {
          const num = parseFloat(v);
          return !isNaN(num) && num >= minDepositKobo / 100;
        },
        `Minimum deposit is ₦${minDepositKobo / 100}`,
      ),
  });
}

function buildPresetAmounts(settings: any): number[] {
  const minDeposit = settings.wallet.minDepositKobo / 100;
  return [minDeposit, 1000, 2000, 5000].filter(
    (a, i, arr) => a === arr[0] || a !== arr[i - 1],
  );
}

type DepositFormValues = { amount: string };

type FlowState = "form" | "processing" | "success";

interface StepFundWalletProps {
  onComplete: () => void;
  onBack: () => void;
}

export function StepFundWallet({ onComplete, onBack }: StepFundWalletProps) {
  const { user, appUser } = useAuth();
  const settings = useSettings();
  const depositSchema = buildDepositSchema(settings);
  const PRESET_AMOUNTS = buildPresetAmounts(settings);
  const [flowState, setFlowState] = useState<FlowState>("form");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const { haptic } = useNativeBridge();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DepositFormValues>({
    resolver: zodResolver(depositSchema),
  });

  const amountValue = watch("amount");

  function selectPreset(amount: number) {
    haptic("selection");
    setSelectedPreset(amount);
    setValue("amount", String(amount), { shouldValidate: true });
  }

  async function onSubmit(values: DepositFormValues) {
    if (!user || !appUser) return;
    haptic("selection");
    setFlowState("processing");

    try {
      const res = await fetch("/api/payments/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(parseFloat(values.amount) * 100), // convert to kobo
          email: appUser.email,
          name: appUser.name,
          phone: appUser.phone,
          redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=2&status=success`,
        }),
      });

      const data = await res.json();
      if (!data.success)
        throw new Error(data.error ?? "Payment initiation failed");

      // Redirect to Flutterwave
      if (data.data?.paymentLink) {
        window.location.href = data.data.paymentLink;
      } else {
        // For demo / dev: simulate success
        setTimeout(() => {
          setFlowState("success");
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not initiate payment. Please try again.");
      haptic("error");
      setFlowState("form");
    }
  }

  if (flowState === "success") {
    return (
      <div className="bg-card ring-1 ring-foreground/10 rounded-2xl p-8 text-center space-y-5">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="flex justify-center"
        >
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2Icon className="size-8 text-primary" />
          </div>
        </motion.div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Wallet funded!</h3>
          <p className="text-sm text-muted-foreground">
            {amountValue &&
              `₦${parseFloat(amountValue).toLocaleString()} has been added to your wallet.`}
          </p>
        </div>
        <Button
          className="w-full"
          onClick={() => {
            haptic("selection");
            onComplete();
          }}
        >
          Continue to circles
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-card ring-1 ring-foreground/10 rounded-2xl p-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Fund your wallet
        </h2>
        <p className="text-sm text-muted-foreground">
          Add money to your AjoSave wallet to start contributing to circles.
          Minimum first deposit is ₦500.
        </p>
      </div>

      {/* Benefits row */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            icon: ZapIcon,
            label: "Instant credit",
            sub: "Funds available immediately",
          },
          {
            icon: WalletIcon,
            label: "Secure wallet",
            sub: "Protected by bank-grade encryption",
          },
        ].map(({ icon: Icon, label, sub }) => (
          <div
            key={label}
            className="rounded-xl bg-muted/50 border border-border p-3 space-y-1"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Icon className="size-3.5 text-primary" />
              {label}
            </div>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Preset amounts */}
        <div className="space-y-1.5">
          <Label>Quick amounts</Label>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => selectPreset(amount)}
                className={cn(
                  "h-9 rounded-lg border text-sm font-medium transition-all",
                  selectedPreset === amount && String(amount) === amountValue
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:border-primary/50 text-foreground",
                )}
              >
                ₦{amount >= 1000 ? `${amount / 1000}k` : amount}
              </button>
            ))}
          </div>
        </div>

        {/* Custom amount */}
        <div className="space-y-1.5">
          <Label htmlFor="deposit-amount">Or enter custom amount (₦)</Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              ₦
            </span>
            <Input
              id="deposit-amount"
              type="number"
              min={String(settings.wallet.minDepositKobo / 100)}
              step="100"
              placeholder={String(settings.wallet.minDepositKobo / 100)}
              className="pl-7"
              aria-invalid={!!errors.amount}
              {...register("amount", {
                onChange: () => setSelectedPreset(null),
              })}
            />
          </div>
          {errors.amount && (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="submit"
            className="w-full"
            disabled={flowState === "processing"}
          >
            {flowState === "processing" && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {flowState === "processing"
              ? "Redirecting to payment…"
              : "Fund wallet"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => {
              haptic("selection");
              onComplete();
            }}
          >
            Skip for now
          </Button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => {
          haptic("selection");
          onBack();
        }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
      >
        <ArrowLeftIcon className="size-3.5" />
        Back to profile
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Step 2 of 3 — Fund Wallet
      </p>
    </div>
  );
}
