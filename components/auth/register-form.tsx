"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";

import { registerSchema, type RegisterFormValues } from "@/lib/validators/auth";
import { signUpWithEmail } from "@/lib/firebase/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

// ─── Password strength indicator ─────────────────────────────────────────────

interface StrengthRule {
  label: string;
  test: (v: string) => boolean;
}

const STRENGTH_RULES: StrengthRule[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One number", test: (v) => /[0-9]/.test(v) },
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 space-y-1">
      {STRENGTH_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.label} className="flex items-center gap-1.5 text-xs">
            {ok ? (
              <CheckCircle2 className="size-3.5 text-green-600 shrink-0" />
            ) : (
              <XCircle className="size-3.5 text-muted-foreground shrink-0" />
            )}
            <span className={ok ? "text-foreground" : "text-muted-foreground"}>
              {rule.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Register form ────────────────────────────────────────────────────────────

export function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralFromUrl = searchParams.get("ref") ?? "";

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { referralCode: referralFromUrl },
  });

  const passwordValue = watch("password") ?? "";

  async function onSubmit(values: RegisterFormValues) {
    try {
      await signUpWithEmail(
        values.name,
        values.email,
        values.phone,
        values.password,
        values.referralCode
      );
      toast.success("Account created! Let's get you set up.");
      router.push("/onboarding");
      router.refresh();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const messages: Record<string, string> = {
        "auth/email-already-in-use": "An account with this email already exists.",
        "auth/invalid-email": "This email address isn't valid.",
        "auth/weak-password": "Password is too weak. Choose a stronger one.",
        "auth/operation-not-allowed": "Email sign-up is not enabled.",
      };
      toast.error(messages[code ?? ""] ?? "Registration failed. Please try again.");
    }
  }

  return (
    <div className="w-full space-y-6">
      <GoogleAuthButton label="Sign up with Google" />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Full name */}
        <div className="space-y-1.5">
          <Label htmlFor="reg-name">Full name</Label>
          <Input
            id="reg-name"
            type="text"
            autoComplete="name"
            placeholder="Amaka Okonkwo"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="reg-email">Email address</Label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="reg-phone">Phone number</Label>
          <Input
            id="reg-phone"
            type="tel"
            autoComplete="tel"
            placeholder="08012345678"
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
          {errors.phone && (
            <p className="text-xs text-destructive">{errors.phone.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="reg-password">Password</Label>
          <div className="relative">
            <Input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className="pr-10"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.password ? (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          ) : (
            <PasswordStrength password={passwordValue} />
          )}
        </div>

        {/* Confirm password */}
        <div className="space-y-1.5">
          <Label htmlFor="reg-confirm">Confirm password</Label>
          <div className="relative">
            <Input
              id="reg-confirm"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              className="pr-10"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Referral code (optional) */}
        <div className="space-y-1.5">
          <Label htmlFor="reg-referral">
            Referral code{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="reg-referral"
            type="text"
            placeholder="e.g. ABC12345"
            className="uppercase placeholder:normal-case"
            {...register("referralCode")}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-3 hover:text-foreground">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-3 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground hover:underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}