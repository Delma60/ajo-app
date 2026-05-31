/**
 * Dispute Service
 * Handles the full lifecycle: raise → under_review → resolved | dismissed.
 * Admin receives an in-app notification + email on every new dispute.
 * Reporter receives a notification when the dispute is resolved or dismissed.
 */

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendNotification } from "@/lib/services/notification-service";
import * as emailSender from "@/lib/email/senders";
import type { Dispute } from "@/lib/types/dispute";
import type { User } from "@/lib/types/user";

// ─── Custom error ─────────────────────────────────────────────────────────────

export class DisputeError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "UNAUTHORIZED"
      | "INVALID_TRANSITION"
      | "INVALID_INPUT",
    message: string
  ) {
    super(message);
    this.name = "DisputeError";
  }
}

// ─── Valid status transitions ─────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<Dispute["status"], Dispute["status"][]> = {
  open: ["under_review", "dismissed"],
  under_review: ["resolved", "dismissed"],
  resolved: [],
  dismissed: [],
};

// ─── Service ──────────────────────────────────────────────────────────────────

export class DisputeService {
  private readonly disputesCol = adminDb.collection("disputes");
  private readonly usersCol = adminDb.collection("users");
  private readonly circlesCol = adminDb.collection("circles");

  /**
   * Raise a new dispute against a circle or a specific member.
   * Creates a Firestore document and notifies all platform admins.
   */
  async raiseDispute(input: {
    circleId: string;
    raisedBy: string;
    type: Dispute["type"];
    description: string;
    againstUserId?: string;
  }): Promise<Dispute> {
    // Validate input
    if (!input.description?.trim()) {
      throw new DisputeError("INVALID_INPUT", "Description is required.");
    }

    // Verify the circle exists
    const circleSnap = await this.circlesCol.doc(input.circleId).get();
    if (!circleSnap.exists) {
      throw new DisputeError("NOT_FOUND", "Circle not found.");
    }
    const circle = circleSnap.data()!;

    // Verify the reporter exists
    const reporterSnap = await this.usersCol.doc(input.raisedBy).get();
    if (!reporterSnap.exists) {
      throw new DisputeError("NOT_FOUND", "Reporter user not found.");
    }
    const reporter = reporterSnap.data() as User;

    // If targeting a specific member, verify they belong to the circle
    if (input.againstUserId) {
      if (!circle.memberIds?.includes(input.againstUserId)) {
        throw new DisputeError(
          "INVALID_INPUT",
          "The specified user is not a member of this circle."
        );
      }
    }

    const disputeRef = this.disputesCol.doc();
    const now = FieldValue.serverTimestamp();

    const dispute: Omit<Dispute, "id"> = {
      circleId: input.circleId,
      raisedBy: input.raisedBy,
      againstUserId: input.againstUserId ?? null,
      type: input.type,
      description: input.description.trim(),
      status: "open",
      createdAt: now as any,
      updatedAt: now as any,
    };

    await disputeRef.set(dispute);

    // Notify all platform admins
    await this.notifyAdmins({
      type: "dispute_raised",
      title: "New Dispute Raised",
      body: `${reporter.name} raised a "${input.type}" dispute for circle "${circle.name}".`,
      link: `/admin/disputes`,
    });

    // Fetch admin emails for the email notification
    const adminSnap = await this.usersCol.where("role", "==", "admin").get();
    if (!adminSnap.empty) {
      const admins = adminSnap.docs.map((d) => d.data() as User);
      for (const admin of admins) {
        void emailSender.sendDisputeRaisedEmails({
          adminEmail: admin.email,
          adminName: admin.name,
          reporterEmail: reporter.email,
          reporterName: reporter.name,
          circleName: circle.name,
          circleId: input.circleId,
          disputeType: input.type,
          description: input.description,
          disputeId: disputeRef.id,
          againstUserName: input.againstUserId
            ? (await this.usersCol.doc(input.againstUserId).get()).data()?.name
            : undefined,
        });
      }
    }

    // Confirm receipt to the reporter
    await sendNotification(input.raisedBy, {
      type: "dispute_raised",
      title: "Dispute Submitted",
      body: `Your dispute for "${circle.name}" has been received. Our team will review it shortly.`,
      link: `/circles/${input.circleId}`,
    });

    return { id: disputeRef.id, ...dispute } as Dispute;
  }

  /**
   * Move a dispute to "under_review". Admin only.
   */
  async markUnderReview(disputeId: string, adminId: string): Promise<Dispute> {
    return this.transition(disputeId, adminId, "under_review");
  }

  /**
   * Resolve a dispute with admin notes. Admin only.
   */
  async resolveDispute(
    disputeId: string,
    adminId: string,
    resolution: string
  ): Promise<Dispute> {
    if (!resolution?.trim()) {
      throw new DisputeError("INVALID_INPUT", "Resolution notes are required.");
    }
    return this.transition(disputeId, adminId, "resolved", resolution.trim());
  }

  /**
   * Dismiss a dispute. Admin only.
   */
  async dismissDispute(
    disputeId: string,
    adminId: string,
    resolution?: string
  ): Promise<Dispute> {
    return this.transition(disputeId, adminId, "dismissed", resolution?.trim());
  }

  /**
   * Fetch a single dispute by ID. Only the reporter, the accused member,
   * and admins may read a dispute.
   */
  async getDispute(disputeId: string, requestingUserId: string): Promise<Dispute> {
    const snap = await this.disputesCol.doc(disputeId).get();
    if (!snap.exists) {
      throw new DisputeError("NOT_FOUND", "Dispute not found.");
    }

    const dispute = { id: snap.id, ...snap.data() } as Dispute;
    const requester = await this.usersCol.doc(requestingUserId).get();
    const isAdmin = (requester.data() as User)?.role === "admin";

    const canRead =
      isAdmin ||
      dispute.raisedBy === requestingUserId ||
      dispute.againstUserId === requestingUserId;

    if (!canRead) {
      throw new DisputeError("UNAUTHORIZED", "You do not have access to this dispute.");
    }

    return dispute;
  }

  /**
   * List all disputes for a circle (admin or circle admin only).
   */
  async getDisputesForCircle(
    circleId: string,
    requestingUserId: string
  ): Promise<Dispute[]> {
    // Verify permission
    const circleSnap = await this.circlesCol.doc(circleId).get();
    if (!circleSnap.exists) {
      throw new DisputeError("NOT_FOUND", "Circle not found.");
    }
    const circle = circleSnap.data()!;

    const requesterSnap = await this.usersCol.doc(requestingUserId).get();
    const isAdmin = (requesterSnap.data() as User)?.role === "admin";
    const isCircleAdmin = circle.adminId === requestingUserId;

    if (!isAdmin && !isCircleAdmin) {
      throw new DisputeError(
        "UNAUTHORIZED",
        "Only the circle admin or a platform admin may list disputes."
      );
    }

    const snap = await this.disputesCol
      .where("circleId", "==", circleId)
      .orderBy("createdAt", "desc")
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Dispute));
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async transition(
    disputeId: string,
    adminId: string,
    newStatus: Dispute["status"],
    resolution?: string
  ): Promise<Dispute> {
    // Verify admin role
    const adminSnap = await this.usersCol.doc(adminId).get();
    if (!adminSnap.exists || (adminSnap.data() as User).role !== "admin") {
      throw new DisputeError("UNAUTHORIZED", "Only platform admins can update disputes.");
    }

    const disputeRef = this.disputesCol.doc(disputeId);
    const disputeSnap = await disputeRef.get();
    if (!disputeSnap.exists) {
      throw new DisputeError("NOT_FOUND", "Dispute not found.");
    }

    const dispute = { id: disputeSnap.id, ...disputeSnap.data() } as Dispute;
    const allowed = VALID_TRANSITIONS[dispute.status];

    if (!allowed.includes(newStatus)) {
      throw new DisputeError(
        "INVALID_TRANSITION",
        `Cannot transition from "${dispute.status}" to "${newStatus}".`
      );
    }

    const update: Partial<Dispute> & Record<string, unknown> = {
      status: newStatus,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (resolution) update.resolution = resolution;

    if (newStatus === "resolved" || newStatus === "dismissed") {
      update.resolvedBy = adminId;
      update.resolvedAt = FieldValue.serverTimestamp();
    }

    await disputeRef.update(update);

    // Notify the reporter on final resolution
    if (newStatus === "resolved" || newStatus === "dismissed") {
      const outcomeLabel = newStatus === "resolved" ? "resolved" : "dismissed";
      await sendNotification(dispute.raisedBy, {
        type: "general",
        title: `Dispute ${outcomeLabel.charAt(0).toUpperCase() + outcomeLabel.slice(1)}`,
        body: resolution
          ? `Your dispute has been ${outcomeLabel}: "${resolution}"`
          : `Your dispute has been ${outcomeLabel} by the platform team.`,
        link: `/circles/${dispute.circleId}`,
      });

      // Fetch the reporter's email and send resolution email
      const reporterSnap = await this.usersCol.doc(dispute.raisedBy).get();
      if (reporterSnap.exists) {
        const reporter = reporterSnap.data() as User;
        const circleSnap = await this.circlesCol.doc(dispute.circleId).get();
        const circleName = circleSnap.data()?.name ?? "your circle";

        void emailSender.sendDisputeResolvedEmail(reporter.email, {
          name: reporter.name,
          circleName,
          outcome: newStatus as "resolved" | "dismissed",
          resolution,
          disputeId: disputeId,
          circleId: dispute.circleId,
        });
      }
    }

    return { ...dispute, ...update } as Dispute;
  }

  /**
   * Send a notification to all users with role === "admin".
   */
  private async notifyAdmins(notification: {
    type: Parameters<typeof sendNotification>[1]["type"];
    title: string;
    body: string;
    link: string;
  }): Promise<void> {
    try {
      const adminSnap = await this.usersCol.where("role", "==", "admin").get();
      const sends = adminSnap.docs.map((d) =>
        sendNotification(d.id, notification)
      );
      await Promise.allSettled(sends);
    } catch (err) {
      console.error("[dispute-service] Failed to notify admins:", err);
    }
  }
}