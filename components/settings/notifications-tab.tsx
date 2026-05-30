"use client";

import { useState } from "react";
import { Loader2, BellIcon, MessageSquareIcon, MailIcon } from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";

import { useAuthStore } from "@/lib/stores/auth-store";
import { db } from "@/lib/firebase/client";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationPrefs {
  // In-app
  inApp_contributionDue: boolean;
  inApp_payoutReceived: boolean;
  inApp_memberJoined: boolean;
  inApp_penaltyApplied: boolean;
  // SMS
  sms_contributionDue: boolean;
  sms_payoutReceived: boolean;
  sms_lateWarning: boolean;
  // Email
  email_contributionReceipt: boolean;
  email_payoutNotice: boolean;
  email_disputeUpdates: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  inApp_contributionDue: true,
  inApp_payoutReceived: true,
  inApp_memberJoined: true,
  inApp_penaltyApplied: true,
  sms_contributionDue: true,
  sms_payoutReceived: true,
  sms_lateWarning: true,
  email_contributionReceipt: true,
  email_payoutNotice: true,
  email_disputeUpdates: true,
};

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
        <p className="text-sm font-medium">{label}</p>
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

// ─── Channel section ──────────────────────────────────────────────────────────

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
  const { appUser, firebaseUser, setAppUser } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);

  // Merge stored prefs with defaults
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => ({
    ...DEFAULT_PREFS,
    ...((appUser as any)?.notificationPrefs ?? {}),
  }));

  const hasPhone = !!(appUser?.phone);

  function update<K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  async function savePrefs() {
    if (!firebaseUser) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        notificationPrefs: prefs,
        updatedAt: serverTimestamp(),
      });
      if (appUser) {
        setAppUser({ ...appUser, ...(({ notificationPrefs: prefs } as any)) });
      }
      toast.success("Notification preferences saved.");
    } catch {
      toast.error("Failed to save preferences. Please try again.");
    } finally {
      setIsSaving(false);
    }
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
      <div className="flex justify-end">
        <Button onClick={savePrefs} disabled={isSaving}>
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          {isSaving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}