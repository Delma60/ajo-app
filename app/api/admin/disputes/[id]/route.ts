import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendNotification } from "@/lib/services/notification-service";
import * as emailSender from "@/lib/email/senders";
import type { User } from "@/lib/types/user";
import type { Dispute } from "@/lib/types/dispute";

const SESSION_COOKIE = "__session";

async function getAdminUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== "admin") return null;
    return { ...decoded, uid: decoded.uid  };
  } catch {
    return null;
  }
}

// ─── Valid transitions ────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ["under_review", "dismissed"],
  under_review: ["resolved", "dismissed"],
  resolved: [],
  dismissed: [],
};

/**
 * GET /api/admin/disputes/[id]
 * Returns full dispute detail enriched with user profiles.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;

    const disputeSnap = await adminDb.collection("disputes").doc(id).get();
    if (!disputeSnap.exists) {
      return NextResponse.json(
        { success: false, data: null, error: "Dispute not found" },
        { status: 404 }
      );
    }

    const d = disputeSnap.data()!;

    // Fetch related entities
    const userIds = [d.raisedBy as string, d.againstUserId as string, d.resolvedBy as string].filter(Boolean);
    const [userSnaps, circleSnap] = await Promise.all([
      userIds.length > 0
        ? adminDb.getAll(...userIds.map((uid) => adminDb.collection("users").doc(uid)))
        : Promise.resolve([]),
      adminDb.collection("circles").doc(d.circleId as string).get(),
    ]);

    const userMap = new Map<string, { name: string; email: string; phone: string; avatarUrl: string | null }>();
    for (const snap of userSnaps) {
      if (snap.exists) {
        const u = snap.data()!;
        userMap.set(snap.id, {
          name: (u.name as string) ?? "",
          email: (u.email as string) ?? "",
          phone: (u.phone as string) ?? "",
          avatarUrl: (u.avatarUrl as string) ?? null,
        });
      }
    }

    const reporter = userMap.get(d.raisedBy as string);
    const accused = d.againstUserId ? userMap.get(d.againstUserId as string) : null;
    const resolver = d.resolvedBy ? userMap.get(d.resolvedBy as string) : null;
    const circle = circleSnap.exists ? circleSnap.data() : null;

    return NextResponse.json({
      success: true,
      data: {
        id: disputeSnap.id,
        circleId: (d.circleId as string) ?? "",
        circleName: (circle?.name as string) ?? "Unknown Circle",
        circleStatus: (circle?.status as string) ?? "unknown",
        raisedBy: (d.raisedBy as string) ?? "",
        reporterName: reporter?.name ?? "Unknown",
        reporterEmail: reporter?.email ?? "",
        reporterPhone: reporter?.phone ?? "",
        reporterAvatarUrl: reporter?.avatarUrl ?? null,
        againstUserId: (d.againstUserId as string) ?? null,
        againstUserName: accused?.name ?? null,
        againstUserEmail: accused?.email ?? null,
        againstUserPhone: accused?.phone ?? null,
        againstUserAvatarUrl: accused?.avatarUrl ?? null,
        type: (d.type as string) ?? "other",
        description: (d.description as string) ?? "",
        status: (d.status as string) ?? "open",
        resolution: (d.resolution as string) ?? null,
        resolvedBy: (d.resolvedBy as string) ?? null,
        resolvedByName: resolver?.name ?? null,
        resolvedAt: d.resolvedAt?.toDate?.()?.toISOString() ?? null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? null,
        allowedTransitions: VALID_TRANSITIONS[d.status as string] ?? [],
      },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/admin/disputes/[id]]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to fetch dispute" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/disputes/[id]
 * Body: { action: "mark_under_review" | "resolve" | "dismiss", resolution?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, resolution } = body;

    const actionToStatus: Record<string, string> = {
      mark_under_review: "under_review",
      resolve: "resolved",
      dismiss: "dismissed",
    };

    const newStatus = actionToStatus[action];
    if (!newStatus) {
      return NextResponse.json(
        { success: false, data: null, error: "Invalid action. Use: mark_under_review, resolve, or dismiss" },
        { status: 400 }
      );
    }

    if ((action === "resolve" || action === "dismiss") && !resolution?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: "Resolution notes are required when resolving or dismissing." },
        { status: 400 }
      );
    }

    const disputeRef = adminDb.collection("disputes").doc(id);
    const disputeSnap = await disputeRef.get();

    if (!disputeSnap.exists) {
      return NextResponse.json(
        { success: false, data: null, error: "Dispute not found" },
        { status: 404 }
      );
    }

    const dispute = disputeSnap.data()!;
    const currentStatus = dispute.status as string;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: `Cannot transition from "${currentStatus}" to "${newStatus}".`,
        },
        { status: 400 }
      );
    }

    const now = FieldValue.serverTimestamp();
    const updates: Record<string, unknown> = {
      status: newStatus,
      updatedAt: now,
    };

    if (resolution?.trim()) updates.resolution = resolution.trim();

    if (newStatus === "resolved" || newStatus === "dismissed") {
      updates.resolvedBy = admin.uid;
      updates.resolvedAt = now;
    }

    await disputeRef.update(updates);

    // Fetch entities for notifications
    const [reporterSnap, circleSnap] = await Promise.all([
      adminDb.collection("users").doc(dispute.raisedBy as string).get(),
      adminDb.collection("circles").doc(dispute.circleId as string).get(),
    ]);

    const reporter = reporterSnap.data() as User | undefined;
    const circleName = (circleSnap.data()?.name as string) ?? "your circle";

    // Notify reporter on final resolution
    if (newStatus === "resolved" || newStatus === "dismissed") {
      const outcomeLabel = newStatus === "resolved" ? "Resolved" : "Dismissed";
      void sendNotification(dispute.raisedBy as string, {
        type: "general",
        title: `Dispute ${outcomeLabel}`,
        body: resolution?.trim()
          ? `Your dispute for "${circleName}" has been ${newStatus}: "${resolution.trim()}"`
          : `Your dispute for "${circleName}" has been ${newStatus} by the platform team.`,
        link: `/circles/${dispute.circleId}`,
      });

      if (reporter?.email) {
        void emailSender.sendDisputeResolvedEmail(reporter.email, {
          name: reporter.name,
          circleName,
          outcome: newStatus as "resolved" | "dismissed",
          resolution: resolution?.trim(),
          disputeId: id,
          circleId: dispute.circleId as string,
        });
      }
    } else if (newStatus === "under_review") {
      void sendNotification(dispute.raisedBy as string, {
        type: "general",
        title: "Dispute Under Review",
        body: `Your dispute for "${circleName}" is now being reviewed by our team. We'll update you soon.`,
        link: `/circles/${dispute.circleId}`,
      });
    }

    return NextResponse.json({
      success: true,
      data: { id, status: newStatus, action },
      error: null,
    });
  } catch (err) {
    console.error("[PATCH /api/admin/disputes/[id]]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to update dispute" },
      { status: 500 }
    );
  }
}