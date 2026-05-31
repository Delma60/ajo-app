"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, BellIcon, MessageSquareIcon, MailIcon, CheckCircle2Icon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { useAuthStore } from "@/lib/stores/auth-store";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { NotificationPrefs } from "@/lib/types/user";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/types/user";

// ─── Toggle row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${disabled ? "text-muted-foreground" : ""}`}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

// ─── Skeleton for loading state ───────────────────────────────────────────────

function ChannelSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-8 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-5 w-9 rounded-full shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Channel section wrapper ──────────────────────────────────────────────────

function ChannelSection({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs mt-0">{subtitle}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotificationsTab() {
  const { appUser, firebaseUser } = useAuthStore();

  const [prefs, setPrefs] = useState<NotificationPrefs>({ ...DEFAULT_NOTIFICATION_PREFS });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const hasPhone = !!(appUser?.phone);

  // ── Load prefs from server on mount ──────────────────────────────────────

  const loadPrefs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/notifications/preferences");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...json.data });
    } catch {
      setLoadError(true);
      // Fall back to whatever is on the appUser doc
      setPrefs({
        ...DEFAULT_NOTIFICATION_PREFS,
        ...((appUser as any)?.notificationPrefs ?? {}),
      });
    } finally {
      setIsLoading(false);
    }
  }, [appUser]);

  useEffect(() => {
    if (firebaseUser) loadPrefs();
  }, [firebaseUser, loadPrefs]);

  // ── Update a single pref key ──────────────────────────────────────────────

  function update<K extends keyof NotificationPrefs>(
    key: K,
    value: NotificationPrefs[K]
  ) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }

  // ── Save all prefs via API route ──────────────────────────────────────────

  async function savePrefs() {
    if (!firebaseUser) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Save failed");

      setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...json.data });
      setIsDirty(false);
      toast.success("Notification preferences saved.", {
        description: "Your settings will apply to all future reminders.",
        icon: <CheckCircle2Icon className="size-4 text-emerald-600" />,
      });
    } catch (err) {
      toast.error("Failed to save preferences. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <ChannelSkeleton />
        <ChannelSkeleton />
        <ChannelSkeleton />
        <div className="flex justify-end">
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <BellIcon className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Couldn't load preferences</p>
          <p className="text-xs text-muted-foreground mt-1">
            Check your connection and try again.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadPrefs} className="gap-1.5">
          <RefreshCwIcon className="size-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* In-app notifications */}
      <ChannelSection
        icon={BellIcon}
        title="In-App Notifications"
        subtitle="Alerts shown inside AjoSave"
      >
        <ToggleRow
          label="Contribution due reminders"
          description="Get notified 24 hours before your contribution is due."
          checked={prefs.inApp_contributionDue}
          onChange={(v) => update("inApp_contributionDue", v)}
        />
        <ToggleRow
          label="Payout received"
          description="Notify me when a payout is credited to my wallet."
          checked={prefs.inApp_payoutReceived}
          onChange={(v) => update("inApp_payoutReceived", v)}
        />
        <ToggleRow
          label="Member joined circle"
          description="Alert me when someone joins a circle I admin."
          checked={prefs.inApp_memberJoined}
          onChange={(v) => update("inApp_memberJoined", v)}
        />
        <ToggleRow
          label="Penalty applied"
          description="Alert me if a late payment penalty is added to my account."
          checked={prefs.inApp_penaltyApplied}
          onChange={(v) => update("inApp_penaltyApplied", v)}
        />
      </ChannelSection>

      {/* SMS notifications */}
      <ChannelSection
        icon={MessageSquareIcon}
        title="SMS Notifications"
        subtitle={
          hasPhone
            ? `Sent to ${appUser!.phone}`
            : "Add a phone number in Profile to enable SMS alerts"
        }
      >
        {!hasPhone && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30 p-3 mb-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              No phone number on file. Add one in the{" "}
              <strong>Profile</strong> tab to receive SMS alerts.
            </p>
          </div>
        )}
        <ToggleRow
          label="Contribution due (SMS)"
          description="Primary reminder channel — sent 24h before due date."
          checked={prefs.sms_contributionDue}
          onChange={(v) => update("sms_contributionDue", v)}
          disabled={!hasPhone}
        />
        <ToggleRow
          label="Payout received (SMS)"
          description="Instant SMS when your payout lands."
          checked={prefs.sms_payoutReceived}
          onChange={(v) => update("sms_payoutReceived", v)}
          disabled={!hasPhone}
        />
        <ToggleRow
          label="Late payment warning (SMS)"
          description="SMS alert when your contribution becomes overdue."
          checked={prefs.sms_lateWarning}
          onChange={(v) => update("sms_lateWarning", v)}
          disabled={!hasPhone}
        />
      </ChannelSection>

      {/* Email notifications */}
      <ChannelSection
        icon={MailIcon}
        title="Email Notifications"
        subtitle={`Sent to ${firebaseUser?.email ?? "your registered email"}`}
      >
        <ToggleRow
          label="Contribution receipts"
          description="Email confirmation every time a contribution is recorded."
          checked={prefs.email_contributionReceipt}
          onChange={(v) => update("email_contributionReceipt", v)}
        />
        <ToggleRow
          label="Payout notifications"
          description="Detailed email when a payout is processed."
          checked={prefs.email_payoutNotice}
          onChange={(v) => update("email_payoutNotice", v)}
        />
        <ToggleRow
          label="Dispute updates"
          description="Email me when a dispute I raised is updated or resolved."
          checked={prefs.email_disputeUpdates}
          onChange={(v) => update("email_disputeUpdates", v)}
        />
      </ChannelSection>

      {/* Save button */}
      <div className="flex items-center justify-between gap-4 py-2">
        {isDirty && !isSaving && (
          <p className="text-xs text-muted-foreground">
            You have unsaved changes.
          </p>
        )}
        {!isDirty && !isSaving && (
          <p className="text-xs text-muted-foreground invisible select-none">
            &nbsp;
          </p>
        )}
        <Button
          onClick={savePrefs}
          disabled={isSaving || !isDirty}
          className="gap-1.5 shrink-0"
        >
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          {isSaving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}