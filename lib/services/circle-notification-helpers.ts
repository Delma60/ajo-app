/**
 * Pref-aware reminder and penalty notification helpers.
 * Drop-in replacements for the inline blocks in circle-service.ts.
 *
 * Import and call these from CircleService instead of inlining
 * sendNotification / smsService calls directly.
 */

import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  sendNotification,
  getBatchNotificationPrefs,
  isSmsContributionDueAllowed,
  isSmsPayoutAllowed,
  isSmsLateWarningAllowed,
  isEmailContributionReceiptAllowed,
  isEmailPayoutNoticeAllowed,
} from "@/lib/services/notification-service";
import * as smsService from "@/lib/services/sms-service";
import type { Circle } from "@/lib/types/circle";
import type { User } from "@/lib/types/user";

// ─── Contribution reminders ───────────────────────────────────────────────────

/**
 * Send due-date reminders to all members who haven't paid yet.
 * Respects inApp_contributionDue and sms_contributionDue preferences.
 */
export async function sendDueRemindersForCircle(
  circle: Circle & { id: string },
  unpaidMemberIds: string[]
): Promise<void> {
  if (unpaidMemberIds.length === 0) return;

  // Batch-fetch prefs and user docs for all unpaid members
  const [prefsMap, userSnaps] = await Promise.all([
    getBatchNotificationPrefs(unpaidMemberIds),
    adminDb.getAll(
      ...unpaidMemberIds.map((id) => adminDb.collection("users").doc(id))
    ),
  ]);

  const userMap = new Map<string, User>();
  for (const snap of userSnaps) {
    if (snap.exists) userMap.set(snap.id, snap.data() as User);
  }

  const sends = unpaidMemberIds.map(async (memberId) => {
    const prefs = prefsMap.get(memberId);
    const user = userMap.get(memberId);
    if (!prefs || !user) return;

    // In-app notification (pref-gated inside sendNotification)
    void sendNotification(
      memberId,
      {
        type: "contribution_due",
        title: "Contribution Due",
        body: `₦${circle.contribution / 100} due for "${circle.name}" — Cycle ${circle.currentCycle}.`,
        link: `/circles/${circle.id}`,
      },
      prefs
    );

    // SMS reminder
    if (user.phone && isSmsContributionDueAllowed(prefs)) {
      void smsService.sendContributionReminder(
        user.phone,
        circle.name,
        circle.contribution
      );
    }
  });

  await Promise.allSettled(sends);
}

// ─── Contribution receipt ─────────────────────────────────────────────────────

/**
 * Notify a member that their contribution was received.
 * Respects email_contributionReceipt and (optionally) sms_contributionDue.
 */
export async function sendContributionReceipt(
  memberId: string,
  user: User,
  circle: Circle & { id: string },
  amountKobo: number
): Promise<void> {
  const prefs = await getBatchNotificationPrefs([memberId]).then(
    (m) => m.get(memberId)
  );
  if (!prefs) return;

  // In-app (always send receipt — not pref-gated)
  void sendNotification(memberId, {
    type: "general",
    title: "Contribution Confirmed",
    body: `₦${amountKobo / 100} contribution to "${circle.name}" recorded for Cycle ${circle.currentCycle}.`,
    link: `/circles/${circle.id}`,
  });

  // SMS receipt
  if (user.phone && isEmailContributionReceiptAllowed(prefs)) {
    // We use the SMS channel for receipt; email integration is a separate service
    void smsService.sendContributionReceived(user.phone, circle.name, amountKobo);
  }
}

// ─── Payout notification ──────────────────────────────────────────────────────

/**
 * Notify the payout recipient.
 * Respects inApp_payoutReceived and sms_payoutReceived preferences.
 */
export async function sendPayoutNotification(
  recipientId: string,
  user: User,
  circleName: string,
  circleId: string,
  netPayoutKobo: number
): Promise<void> {
  const prefs = await getBatchNotificationPrefs([recipientId]).then(
    (m) => m.get(recipientId)
  );
  if (!prefs) return;

  // In-app
  void sendNotification(
    recipientId,
    {
      type: "payout_received",
      title: "Payout Received! 🎉",
      body: `₦${netPayoutKobo / 100} has been credited to your wallet from "${circleName}".`,
      link: "/wallet",
    },
    prefs
  );

  // SMS
  if (user.phone && isSmsPayoutAllowed(prefs)) {
    void smsService.sendPayoutReceived(user.phone, circleName, netPayoutKobo);
  }
}

// ─── Late payment warning ─────────────────────────────────────────────────────

/**
 * Warn a member that their payment is late and a penalty applies.
 * Respects inApp_penaltyApplied and sms_lateWarning preferences.
 */
export async function sendLatePaymentWarning(
  memberId: string,
  user: User,
  circle: Circle & { id: string },
  penaltyKobo: number
): Promise<void> {
  const prefs = await getBatchNotificationPrefs([memberId]).then(
    (m) => m.get(memberId)
  );
  if (!prefs) return;

  // In-app
  void sendNotification(
    memberId,
    {
      type: "penalty_applied",
      title: "Late Payment Warning",
      body: `Your contribution to "${circle.name}" is late. A ₦${penaltyKobo / 100} penalty applies on payment.`,
      link: `/circles/${circle.id}`,
    },
    prefs
  );

  // SMS
  if (user.phone && isSmsLateWarningAllowed(prefs)) {
    void smsService.sendLatePaymentWarning(
      user.phone,
      circle.name,
      penaltyKobo
    );
  }
}