"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  EyeIcon,
  EyeOffIcon,
  ShieldCheckIcon,
  LogOutIcon,
  AlertTriangleIcon,
} from "lucide-react";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { toast } from "sonner";

import { useAuthStore } from "@/lib/stores/auth-store";
import { auth } from "@/lib/firebase/client";
import { signOut } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z
      .string()
      .min(8, "Must be at least 8 characters")
      .regex(/[A-Z]/, "Must include an uppercase letter")
      .regex(/[0-9]/, "Must include a number"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

// ─── Password strength indicator ─────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const checks = [
    { label: "8+ characters", pass: password.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
    { label: "Special character", pass: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = checks.filter((c) => c.pass).length;
  const barColor =
    score <= 1
      ? "bg-red-500"
      : score === 2
      ? "bg-amber-500"
      : score === 3
      ? "bg-yellow-500"
      : "bg-emerald-500";
  const label =
    score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= score ? barColor : "bg-muted"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label} password</p>
        <div className="flex gap-2">
          {checks.map(({ label, pass }) => (
            <span
              key={label}
              className={`text-[10px] ${pass ? "text-emerald-600" : "text-muted-foreground"}`}
            >
              {pass ? "✓" : "·"} {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SecurityTab() {
  const { firebaseUser } = useAuthStore();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);

  const isGoogleUser =
    firebaseUser?.providerData?.some((p) => p.providerId === "google.com") ?? false;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  const newPasswordValue = watch("newPassword") ?? "";

  async function onSubmit(values: PasswordFormValues) {
    if (!firebaseUser || !firebaseUser.email) return;
    setIsSaving(true);

    try {
      // Re-authenticate first
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        values.currentPassword
      );
      await reauthenticateWithCredential(firebaseUser, credential);

      // Then update password
      await updatePassword(firebaseUser, values.newPassword);

      toast.success("Password changed successfully.");
      reset();
    } catch (err: any) {
      if (err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") {
        toast.error("Current password is incorrect.");
      } else if (err?.code === "auth/requires-recent-login") {
        toast.error("Please sign out and sign in again before changing your password.");
      } else {
        toast.error("Failed to change password. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Password change */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            {isGoogleUser
              ? "You signed in with Google. Password changes are managed through your Google account."
              : "Choose a strong password you don't use elsewhere."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isGoogleUser ? (
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border p-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted shrink-0">
                <ShieldCheckIcon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Google Account</p>
                <p className="text-xs text-muted-foreground">
                  Your account is secured by Google. Manage your password at myaccount.google.com.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              {/* Current password */}
              <div className="space-y-1.5">
                <Label htmlFor="current-password">Current password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrent ? "text" : "password"}
                    autoComplete="current-password"
                    aria-invalid={!!errors.currentPassword}
                    {...register("currentPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showCurrent ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </button>
                </div>
                {errors.currentPassword && (
                  <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
                )}
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    autoComplete="new-password"
                    aria-invalid={!!errors.newPassword}
                    {...register("newPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNew ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </button>
                </div>
                {errors.newPassword && (
                  <p className="text-xs text-destructive">{errors.newPassword.message}</p>
                )}
                <PasswordStrength password={newPasswordValue} />
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    aria-invalid={!!errors.confirmPassword}
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirm ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                {isSaving ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Active session / sign out */}
      <Card>
        <CardHeader>
          <CardTitle>Active Session</CardTitle>
          <CardDescription>
            You are currently signed in. Sign out to end your session on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {firebaseUser?.email ?? "Current session"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Signed in{" "}
                {isGoogleUser ? "via Google" : "with email & password"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setSignOutDialogOpen(true)}
            >
              <LogOutIcon className="size-3.5" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangleIcon className="size-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that affect your entire account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => toast.info("Account deletion requires support. Contact us at support@ajosave.app.")}
            >
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sign out confirm dialog */}
      <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be signed out of your AjoSave account on this device. You can sign back in at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}