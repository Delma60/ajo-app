import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Notification } from "@/lib/types/notification";

type CreateNotificationInput = Pick<
  Notification,
  "type" | "title" | "body" | "link"
>;

/**
 * Creates an in-app notification document in Firestore for the given user.
 * Fire-and-forget: does not throw on failure to avoid breaking the calling transaction.
 */
export async function sendNotification(
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
    console.error("[notification-service] Failed to create notification:", err);
  }
}

/**
 * Marks a notification as read.
 */
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

/**
 * Marks all notifications for a user as read.
 */
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