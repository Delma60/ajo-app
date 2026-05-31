import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendNotification } from "@/lib/services/notification-service";

const SESSION_COOKIE = "__session";

async function getSessionUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}

/**
 * POST /api/circles/[id]/requests
 * Body: { userId: string, action: "approve" | "decline" }
 *
 * Admin-only: approve or decline a pending join request.
 * On approval, the user is added to memberIds and their circleIds updated.
 * On decline, the user is removed from pendingRequestIds with a notification.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: circleId } = await params;
    const body = await request.json();
    const { userId, action } = body;

    if (!userId || typeof userId !== "string") {
      return Response.json(
        { success: false, data: null, error: "userId is required" },
        { status: 400 }
      );
    }

    if (!action || !["approve", "decline"].includes(action)) {
      return Response.json(
        { success: false, data: null, error: "action must be 'approve' or 'decline'" },
        { status: 400 }
      );
    }

    // Fetch circle and verify caller is the admin
    const circleRef = adminDb.collection("circles").doc(circleId);
    const circleSnap = await circleRef.get();

    if (!circleSnap.exists) {
      return Response.json(
        { success: false, data: null, error: "Circle not found" },
        { status: 404 }
      );
    }

    const circle = circleSnap.data()!;

    if (circle.adminId !== sessionUser.uid) {
      return Response.json(
        { success: false, data: null, error: "Only the circle admin can manage join requests" },
        { status: 403 }
      );
    }

    const pendingIds: string[] = circle.pendingRequestIds ?? [];
    if (!pendingIds.includes(userId)) {
      return Response.json(
        { success: false, data: null, error: "No pending request found for this user" },
        { status: 404 }
      );
    }

    // Fetch requesting user details for notifications
    const userSnap = await adminDb.collection("users").doc(userId).get();
    const userData = userSnap.data();
    const userName = userData?.name ?? "A user";

    const now = FieldValue.serverTimestamp();

    if (action === "approve") {
      // Guard: circle must not be full
      const currentMembers: string[] = circle.memberIds ?? [];
      if (currentMembers.length >= circle.maxMembers) {
        return Response.json(
          { success: false, data: null, error: "Circle is full. Cannot approve new members." },
          { status: 409 }
        );
      }

      // Guard: circle must still be active
      if (circle.status !== "active") {
        return Response.json(
          { success: false, data: null, error: "Cannot approve members for an inactive circle." },
          { status: 409 }
        );
      }

      // Atomic batch: add to memberIds, remove from pendingRequestIds, update user's circleIds
      const batch = adminDb.batch();

      batch.update(circleRef, {
        memberIds: FieldValue.arrayUnion(userId),
        pendingRequestIds: FieldValue.arrayRemove(userId),
        updatedAt: now,
      });

      batch.update(adminDb.collection("users").doc(userId), {
        circleIds: FieldValue.arrayUnion(circleId),
        updatedAt: now,
      });

      await batch.commit();

      // Notify the approved user
      void sendNotification(userId, {
        type: "member_joined",
        title: "Join Request Approved! 🎉",
        body: `You have been approved to join "${circle.name}". Welcome to the circle!`,
        link: `/circles/${circleId}`,
      });

      // Notify the admin
      void sendNotification(sessionUser.uid, {
        type: "general",
        title: "Member Approved",
        body: `${userName} has been approved and added to "${circle.name}".`,
        link: `/circles/${circleId}`,
      });

      return Response.json({
        success: true,
        data: { action: "approved", userId, circleName: circle.name },
        error: null,
      });
    } else {
      // Decline: remove from pendingRequestIds only
      await circleRef.update({
        pendingRequestIds: FieldValue.arrayRemove(userId),
        updatedAt: now,
      });

      // Notify the declined user
      void sendNotification(userId, {
        type: "general",
        title: "Join Request Declined",
        body: `Your request to join "${circle.name}" was not approved at this time.`,
        link: `/circles`,
      });

      return Response.json({
        success: true,
        data: { action: "declined", userId, circleName: circle.name },
        error: null,
      });
    }
  } catch (err) {
    console.error("[POST /api/circles/[id]/requests]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to process join request" },
      { status: 500 }
    );
  }
}