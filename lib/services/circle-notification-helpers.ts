/**
 * Circle Notification Helpers — updated with email integration.
 *
 * Drop-in replacement for the existing file at:
 *   lib/services/circle-notification-helpers.ts
 *
 * Changes vs original:
 *  - sendDueRemindersForCircle  → adds email fallback if SMS is disabled
 *  - sendContributionReceipt    → sends email receipt if pref allows
 *  - sendPayoutNotification     → sends payout email if pref allows
 *  - sendLatePaymentWarning     → sends late-warning email if pref allows
 *
 * Strategy: SMS is primary for time-sensitive events.
 * Email is always sent for transactional receipts (contributions, payouts).
 * For reminders/warnings, email is sent as a fallback when SMS is off.
 */

'use server';

import { adminDb } from "@/lib/firebase/admin";
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
import * as emailSender from "@/lib/email/senders";
import type { Circle } from "@/lib/types/circle";
import type { User } from "@/lib/types/user";

// ─── Contribution reminders ───────────────────────────────────────────────────

export async function sendDueRemindersForCircle(
  circle: Circle & { id: string },
  unpaidMemberIds: string[]
): Promise<void> {
  if (unpaidMemberIds.length === 0) return;

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

    // In-app notification
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

    // SMS (primary channel)
    const smsSent =
      user.phone && isSmsContributionDueAllowed(prefs)
        ? await smsService
            .sendContributionReminder(user.phone, circle.name, circle.contribution)
            .then(() => true)
            .catch(() => false)
        : false;

    // Email fallback — send if SMS was not sent or user has no phone
    if (!smsSent && prefs.inApp_contributionDue) {
      void emailSender.sendContributionReminderEmail(user.email, {
        name: user.name,
        circleName: circle.name,
        amountKobo: circle.contribution,
        dueDate: circle.nextDueDate?.toDate?.() ?? new Date(),
        cycleNumber: circle.currentCycle,
        circleId: circle.id,
      });
    }
  });

  await Promise.allSettled(sends);
}

// ─── Contribution receipt ─────────────────────────────────────────────────────

export async function sendContributionReceipt(
  memberId: string,
  user: User,
  circle: Circle & { id: string },
  amountKobo: number,
  options: {
    penaltyKobo?: number;
    transactionReference?: string;
    paidAt?: Date;
  } = {}
): Promise<void> {
  const prefs = await getBatchNotificationPrefs([memberId]).then(
    (m) => m.get(memberId)
  );

  // In-app (always)
  void sendNotification(memberId, {
    type: "general",
    title: "Contribution Confirmed",
    body: `₦${amountKobo / 100} contribution to "${circle.name}" recorded for Cycle ${circle.currentCycle}.`,
    link: `/circles/${circle.id}`,
  });

  // SMS receipt
  if (user.phone) {
    void smsService.sendContributionReceived(user.phone, circle.name, amountKobo);
  }

  // Email receipt (pref-gated)
  if (!prefs || isEmailContributionReceiptAllowed(prefs)) {
    void emailSender.sendContributionReceiptEmail(user.email, {
      name: user.name,
      circleName: circle.name,
      amountKobo,
      penaltyKobo: options.penaltyKobo ?? 0,
      paidAt: options.paidAt ?? new Date(),
      cycleNumber: circle.currentCycle,
      transactionReference: options.transactionReference ?? "—",
      circleId: circle.id,
    });
  }
}

// ─── Payout notification ──────────────────────────────────────────────────────

export async function sendPayoutNotification(
  recipientId: string,
  user: User,
  circleName: string,
  circleId: string,
  netPayoutKobo: number,
  options: {
    grossPayoutKobo?: number;
    platformFeeKobo?: number;
    cycleNumber?: number;
    transactionReference?: string;
    payoutDate?: Date;
  } = {}
): Promise<void> {
  const prefs = await getBatchNotificationPrefs([recipientId]).then(
    (m) => m.get(recipientId)
  );

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
  if (user.phone && (!prefs || isSmsPayoutAllowed(prefs))) {
    void smsService.sendPayoutReceived(user.phone, circleName, netPayoutKobo);
  }

  // Email (pref-gated)
  if (!prefs || isEmailPayoutNoticeAllowed(prefs)) {
    const gross = options.grossPayoutKobo ?? netPayoutKobo;
    const fee = options.platformFeeKobo ?? 0;

    void emailSender.sendPayoutEmail(user.email, {
      name: user.name,
      circleName,
      grossPayoutKobo: gross,
      platformFeeKobo: fee,
      netPayoutKobo,
      cycleNumber: options.cycleNumber ?? 1,
      circleId,
      payoutDate: options.payoutDate ?? new Date(),
      transactionReference: options.transactionReference ?? "—",
    });
  }
}

// ─── Late payment warning ─────────────────────────────────────────────────────

export async function sendLatePaymentWarning(
  memberId: string,
  user: User,
  circle: Circle & { id: string },
  penaltyKobo: number
): Promise<void> {
  const prefs = await getBatchNotificationPrefs([memberId]).then(
    (m) => m.get(memberId)
  );

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

  // SMS (primary)
  const smsSent =
    user.phone && (!prefs || isSmsLateWarningAllowed(prefs))
      ? await smsService
          .sendLatePaymentWarning(user.phone, circle.name, penaltyKobo)
          .then(() => true)
          .catch(() => false)
      : false;

  // Email fallback
  if (!smsSent) {
    void emailSender.sendLatePaymentEmail(user.email, {
      name: user.name,
      circleName: circle.name,
      contributionKobo: circle.contribution,
      penaltyKobo,
      circleId: circle.id,
      originalDueDate: circle.nextDueDate?.toDate?.() ?? new Date(),
    });
  }
}