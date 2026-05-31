import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Notification } from "@/lib/types/notification";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from "@/lib/types/user";

type CreateNotificationInput = Pick<
  Notification,
  "type" | "title" | "body" | "link"
>;

// ─── Pref helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch a user's notification preferences, falling back to defaults.
 * Safe to call outside a transaction.
 */
export async function getUserNotificationPrefs(
  userId: string
): Promise<NotificationPrefs> {
  try {
    const snap = await adminDb.collection("users").doc(userId).get();
    if (!snap.exists) return { ...DEFAULT_NOTIFICATION_PREFS };
    return {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(snap.data()?.notificationPrefs ?? {}),
    };
  } catch {
    // Fail open — don't block notifications if prefs can't be read
    return { ...DEFAULT_NOTIFICATION_PREFS };
  }
}

/**
 * Batch-fetch prefs for multiple users at once.
 * Returns a map of userId → prefs. Unresolvable users get defaults.
 */
export async function getBatchNotificationPrefs(
  userIds: string[]
): Promise<Map<string, NotificationPrefs>> {
  const result = new Map<string, NotificationPrefs>();
  if (userIds.length === 0) return result;

  try {
    // Firestore getAll supports up to 500 docs
    const refs = userIds.map((id) =>
      adminDb.collection("users").doc(id)
    );
    const snaps = await adminDb.getAll(...refs);
    for (const snap of snaps) {
      result.set(snap.id, {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...(snap.exists ? snap.data()?.notificationPrefs ?? {} : {}),
      });
    }
  } catch (err) {
    console.error("[notification-service] getBatchNotificationPrefs failed:", err);
    // Fail open
    for (const id of userIds) {
      result.set(id, { ...DEFAULT_NOTIFICATION_PREFS });
    }
  }

  return result;
}

// ─── In-app notification delivery ────────────────────────────────────────────

/**
 * Creates an in-app notification document in Firestore for the given user.
 * Respects the user's inApp_* preferences.
 * Fire-and-forget: does not throw on failure.
 */
export async function sendNotification(
  userId: string,
  input: CreateNotificationInput,
  prefsOverride?: NotificationPrefs
): Promise<void> {
  try {
    // Check in-app pref for this notification type
    const prefs =
      prefsOverride ?? (await getUserNotificationPrefs(userId));

    const allowed = isInAppAllowed(input.type, prefs);
    if (!allowed) return;

    const notifRef = adminDb.collection("notifications").doc();
    await notifRef.set({
      id: notifRef.id,
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      read: false,
      link: input.link ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("[notification-service] Failed to create notification:", err);
  }
}

/**
 * Send notification WITHOUT pref checks — used for critical system events
 * (e.g. circle deleted, account suspended) that must always be delivered.
 */
export async function sendSystemNotification(
  userId: string,
  input: CreateNotificationInput
): Promise<void> {
  try {
    const notifRef = adminDb.collection("notifications").doc();
    await notifRef.set({
      id: notifRef.id,
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      read: false,
      link: input.link ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error(
      "[notification-service] Failed to create system notification:",
      err
    );
  }
}

// ─── Pref gate helpers ────────────────────────────────────────────────────────

function isInAppAllowed(
  type: Notification["type"],
  prefs: NotificationPrefs
): boolean {
  switch (type) {
    case "contribution_due":
      return prefs.inApp_contributionDue;
    case "payout_received":
      return prefs.inApp_payoutReceived;
    case "member_joined":
      return prefs.inApp_memberJoined;
    case "penalty_applied":
      return prefs.inApp_penaltyApplied;
    // Dispute, circle_invite, and general always go through
    default:
      return true;
  }
}

export function isSmsContributionDueAllowed(prefs: NotificationPrefs): boolean {
  return prefs.sms_contributionDue;
}

export function isSmsPayoutAllowed(prefs: NotificationPrefs): boolean {
  return prefs.sms_payoutReceived;
}

export function isSmsLateWarningAllowed(prefs: NotificationPrefs): boolean {
  return prefs.sms_lateWarning;
}

export function isEmailContributionReceiptAllowed(
  prefs: NotificationPrefs
): boolean {
  return prefs.email_contributionReceipt;
}

export function isEmailPayoutNoticeAllowed(prefs: NotificationPrefs): boolean {
  return prefs.email_payoutNotice;
}

// ─── Legacy helpers ───────────────────────────────────────────────────────────

export async function markAsRead(notificationId: string): Promise<void> {
  try {
    await adminDb
      .collection("notifications")
      .doc(notificationId)
      .update({ read: true });
  } catch (err) {
    console.error("[notification-service] Failed to mark as read:", err);
  }
}

export async function markAllAsRead(userId: string): Promise<void> {
  try {
    const snap = await adminDb
      .collection("notifications")
      .where("userId", "==", userId)
      .where("read", "==", false)
      .get();

    const batch = adminDb.batch();
    snap.docs.forEach((doc) => batch.update(doc.ref, { read: true }));
    await batch.commit();
  } catch (err) {
    console.error("[notification-service] Failed to mark all as read:", err);
  }
}