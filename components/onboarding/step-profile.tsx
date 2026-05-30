"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, PhoneIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { useAuth } from "@/lib/hooks/use-auth";
import { db } from "@/lib/firebase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const profileSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(
      /^(\+?234|0)[7-9][0-1]\d{8}$/,
      "Enter a valid Nigerian phone number (e.g. 08012345678)"
    ),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface StepProfileProps {
  onComplete: () => void;
}

export function StepProfile({ onComplete }: StepProfileProps) {
  const { user, appUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { phone: appUser?.phone ?? "" },
  });

  async function onSubmit(values: ProfileFormValues) {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        phone: values.phone,
        updatedAt: serverTimestamp(),
      });
      toast.success("Phone number saved!");
      onComplete();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save phone number. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="bg-card ring-1 ring-foreground/10 rounded-2xl p-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Complete your profile
        </h2>
        <p className="text-sm text-muted-foreground">
          Your phone number is needed for contribution reminders and withdrawal verification.
        </p>
      </div>

      {/* Why we need this */}
      <Alert className="border-primary/20 bg-primary/5">
        <ShieldCheckIcon className="size-4 text-primary" />
        <AlertDescription className="text-xs text-foreground/80">
          We use your number for SMS reminders only — never shared or sold. Standard rates apply.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="onboarding-phone">Nigerian phone number</Label>
          <div className="relative">
            <PhoneIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="onboarding-phone"
              type="tel"
              autoComplete="tel"
              placeholder="08012345678"
              className="pl-8"
              aria-invalid={!!errors.phone}
              {...register("phone")}
            />
          </div>
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSaving}>
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          {isSaving ? "Saving…" : "Continue"}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        Step 1 of 3 — Profile Setup
      </p>
    </div>
  );
}