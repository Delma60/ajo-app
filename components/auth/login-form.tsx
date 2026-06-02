"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { loginSchema, type LoginFormValues } from "@/lib/validators/auth";
import { signInWithEmail, resetPassword } from "@/lib/firebase/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginFormValues) {
    try {
      await signInWithEmail(values.email, values.password);
      toast.success("Welcome back!");
      // Determine role from readable meta cookie and prefer admin landing
      try {
        const metaCookie =
          typeof document !== "undefined"
            ? document.cookie
                .split("; ")
                .find((c) => c.trim().startsWith("__user_meta="))
            : null;
        if (metaCookie) {
          const raw = metaCookie.split("=").slice(1).join("=");
          const parsed = JSON.parse(decodeURIComponent(raw));
          if (!searchParams.get("redirect") && parsed?.role === "admin") {
            router.push("/admin");
            router.refresh();
            return;
          }
        }
      } catch (e) {
        // ignore and fallback to default redirect
      }
      router.push(redirectTo);
      router.refresh();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const messages: Record<string, string> = {
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password. Please try again.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/too-many-requests": "Too many attempts. Please try again later.",
        "auth/user-disabled": "This account has been suspended.",
      };
      toast.error(messages[code ?? ""] ?? "Sign-in failed. Please try again.");
    }
  }

  async function handleForgotPassword() {
    const email = getValues("email");
    if (!email) {
      toast.error("Enter your email address first.");
      return;
    }
    setIsForgotLoading(true);
    try {
      await resetPassword(email);
      toast.success("Password reset email sent. Check your inbox.");
    } catch {
      toast.error(
        "Could not send reset email. Check the address and try again.",
      );
    } finally {
      setIsForgotLoading(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <GoogleAuthButton label="Continue with Google" />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email address</Label>
          <Input
            id="login-email"
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

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isForgotLoading}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {isForgotLoading ? "Sending…" : "Forgot password?"}
            </button>
          </div>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
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
          {errors.password && (
            <p className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-foreground hover:underline underline-offset-4"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
