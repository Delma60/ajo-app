"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  CameraIcon,
  CheckCircle2Icon,
  ClockIcon,
  AlertCircleIcon,
  Copy,
  CheckIcon,
  ShareIcon,
} from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { toast } from "sonner";

import { useAuthStore } from "@/lib/stores/auth-store";
import { auth, db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const profileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name must be under 60 characters"),
  phone: z
    .string()
    .regex(/^(\+?234|0)[7-9][0-1]\d{8}$/, "Enter a valid Nigerian phone number"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const KYC_META = {
  unverified: {
    label: "Not Verified",
    description: "Complete KYC to unlock full platform features and higher payout limits.",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: AlertCircleIcon,
    iconCls: "text-red-500",
  },
  pending: {
    label: "Verification Pending",
    description: "Your documents are under review. This usually takes 1–2 business days.",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: ClockIcon,
    iconCls: "text-amber-500",
  },
  verified: {
    label: "Verified",
    description: "Your identity has been verified. You have full access to all features.",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: CheckCircle2Icon,
    iconCls: "text-emerald-500",
  },
};

export function ProfileTab() {
  const { appUser, firebaseUser, setAppUser } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: appUser?.name ?? "",
      phone: appUser?.phone ?? "",
    },
  });

  const kycStatus = appUser?.kycStatus ?? "unverified";
  const kycMeta = KYC_META[kycStatus];
  const KycIcon = kycMeta.icon;

  const initials = (appUser?.name ?? firebaseUser?.displayName ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ajosave.app"}/register?ref=${appUser?.referralCode ?? ""}`;

  async function onSubmit(values: ProfileFormValues) {
    if (!firebaseUser) return;
    setIsSaving(true);
    try {
      // Update Firebase Auth display name
      await updateProfile(firebaseUser, { displayName: values.name });

      // Update Firestore user doc
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        name: values.name,
        phone: values.phone,
        updatedAt: serverTimestamp(),
      });

      // Sync Zustand store
      if (appUser) {
        setAppUser({ ...appUser, name: values.name, phone: values.phone });
      }

      toast.success("Profile updated successfully.");
    } catch {
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function copyReferral() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    });
  }

  function shareReferral() {
    if (navigator.share) {
      navigator.share({
        title: "Join me on AjoSave",
        text: "Save smarter together with AjoSave community circles!",
        url: referralLink,
      });
    } else {
      copyReferral();
    }
  }

  return (
    <div className="space-y-6">
      {/* Avatar section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
          <CardDescription>Your photo helps circle members recognise you.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-5">
          <div className="relative">
            <Avatar className="size-16">
              <AvatarImage src={appUser?.avatarUrl ?? firebaseUser?.photoURL ?? undefined} />
              <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/80 transition-colors"
            >
              <CameraIcon className="size-3" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={() => toast.info("Avatar upload coming soon.")}
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{appUser?.name ?? firebaseUser?.displayName ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{firebaseUser?.email ?? "—"}</p>
            <Badge
              variant="outline"
              className={cn("text-[10px] h-4 border-0 mt-1", kycMeta.badge)}
            >
              {kycMeta.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Profile form */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your name and phone number.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input
                value={firebaseUser?.email ?? ""}
                readOnly
                disabled
                className="bg-muted/50 cursor-not-allowed text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact support if you need help.
              </p>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                placeholder="Adaeze Okonkwo"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone">Phone number</Label>
              <Input
                id="profile-phone"
                type="tel"
                placeholder="08012345678"
                aria-invalid={!!errors.phone}
                {...register("phone")}
              />
              {errors.phone ? (
                <p className="text-xs text-destructive">{errors.phone.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Used for SMS contribution reminders. Nigerian numbers only.
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSaving || !isDirty} className="w-full sm:w-auto">
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* KYC status */}
      <Card>
        <CardHeader>
          <CardTitle>Identity Verification (KYC)</CardTitle>
          <CardDescription>
            Verified accounts can create circles and receive payouts above ₦50,000.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                kycStatus === "verified"
                  ? "bg-emerald-100 dark:bg-emerald-900/30"
                  : kycStatus === "pending"
                  ? "bg-amber-100 dark:bg-amber-900/30"
                  : "bg-red-100 dark:bg-red-900/30"
              )}
            >
              <KycIcon className={cn("size-5", kycMeta.iconCls)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{kycMeta.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{kycMeta.description}</p>
            </div>
          </div>

          {kycStatus !== "verified" && (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => toast.info("KYC verification flow coming soon.")}
            >
              {kycStatus === "pending" ? "Check verification status" : "Start KYC Verification"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Referral section */}
      <Card>
        <CardHeader>
          <CardTitle>Referral Program</CardTitle>
          <CardDescription>
            Earn ₦500 for every friend who makes their first deposit of ₦1,000 or more.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Your referral code</Label>
            <div className="flex gap-2">
              <Input
                value={appUser?.referralCode ?? "—"}
                readOnly
                className="font-mono font-semibold bg-muted/50 cursor-default"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyReferral}
                className="shrink-0"
              >
                {referralCopied ? (
                  <CheckIcon className="size-4 text-emerald-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Your referral link</Label>
            <div className="flex gap-2">
              <Input
                value={referralLink}
                readOnly
                className="text-xs bg-muted/50 cursor-default text-muted-foreground"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={shareReferral}
              >
                <ShareIcon className="size-3.5" />
                Share
              </Button>
            </div>
          </div>

          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-lg font-bold font-mono text-foreground">
                {appUser?.referralBonusAmount
                  ? `₦${(appUser.referralBonusAmount / 100).toLocaleString()}`
                  : "₦0"}
              </p>
              <p className="text-xs text-muted-foreground">Total earned</p>
            </div>
            <div>
              <p className="text-lg font-bold font-mono text-foreground">₦500</p>
              <p className="text-xs text-muted-foreground">Per referral</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}