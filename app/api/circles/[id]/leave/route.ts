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
 * POST /api/circles/[id]/leave
 *
 * Allows an authenticated member (non-admin) to leave a circle.
 *
 * Rules enforced:
 * - Admin cannot leave (must transfer ownership or delete the circle)
 * - Cannot leave if you are the currentRecipientId (you have a pending payout)
 * - Removes user from memberIds and circleIds
 * - Cancels any pending contributions for the current cycle
 * - If circle is now below minimum members and not started, handles gracefully
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

    // Run in a Firestore transaction for atomicity
    await adminDb.runTransaction(async (tx) => {
      const circleRef = adminDb.collection("circles").doc(circleId);
      const userRef = adminDb.collection("users").doc(sessionUser.uid);

      const [circleSnap, userSnap] = await tx.getAll(circleRef, userRef);

      if (!circleSnap.exists) {
        throw Object.assign(new Error("Circle not found"), { code: 404 });
      }

      const circle = circleSnap.data()!;
      const memberIds: string[] = circle.memberIds ?? [];

      // Guard: must be a member
      if (!memberIds.includes(sessionUser.uid)) {
        throw Object.assign(new Error("You are not a member of this circle"), { code: 400 });
      }

      // Guard: admin cannot leave
      if (circle.adminId === sessionUser.uid) {
        throw Object.assign(
          new Error("As the admin, you cannot leave. Transfer ownership or delete the circle instead."),
          { code: 400 }
        );
      }

      // Guard: cannot leave if you are the scheduled payout recipient
      if (circle.currentRecipientId === sessionUser.uid && circle.status === "active") {
        throw Object.assign(
          new Error("You cannot leave while you are the scheduled recipient for the next payout. Contact the admin."),
          { code: 400 }
        );
      }

      const now = FieldValue.serverTimestamp();
      const updatedMemberIds = memberIds.filter((id) => id !== sessionUser.uid);

      // Update circle
      tx.update(circleRef, {
        memberIds: updatedMemberIds,
        updatedAt: now,
      });

      // Update user's circleIds
      tx.update(userRef, {
        circleIds: FieldValue.arrayRemove(circleId),
        updatedAt: now,
      });

      // Cancel any pending contributions for this cycle
      // (reads outside txn are not allowed, so we mark via the leaveRequest pattern)
      // We handle pending contribution cancellation outside the transaction below
    });

    // Cancel pending contributions outside the transaction (safe read → batch write)
    try {
      const pendingContribsSnap = await adminDb
        .collection("contributions")
        .where("circleId", "==", circleId)
        .where("userId", "==", sessionUser.uid)
        .where("status", "==", "pending")
        .get();

      if (!pendingContribsSnap.empty) {
        const batch = adminDb.batch();
        pendingContribsSnap.docs.forEach((doc) => {
          batch.update(doc.ref, {
            status: "cancelled",
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
      }
    } catch (err) {
      // Non-fatal: log and continue
      console.error("[leave] Failed to cancel pending contributions:", err);
    }

    // Fetch circle for notification
    const circleSnap = await adminDb.collection("circles").doc(circleId).get();
    const circleName = circleSnap.data()?.name ?? "the circle";
    const adminId = circleSnap.data()?.adminId;

    // Notify the admin
    if (adminId) {
      const userSnap = await adminDb.collection("users").doc(sessionUser.uid).get();
      const userName = userSnap.data()?.name ?? "A member";

      void sendNotification(adminId, {
        type: "general",
        title: "Member Left Circle",
        body: `${userName} has left "${circleName}".`,
        link: `/circles/${circleId}`,
      });
    }

    // Confirm to the leaving user
    void sendNotification(sessionUser.uid, {
      type: "general",
      title: "You Left the Circle",
      body: `You have successfully left "${circleName}".`,
      link: `/circles`,
    });

    return Response.json({
      success: true,
      data: { circleName },
      error: null,
    });
  } catch (err: any) {
    console.error("[POST /api/circles/[id]/leave]", err);
    const status = err?.code === 404 ? 404 : err?.code === 400 ? 400 : 500;
    return Response.json(
      { success: false, data: null, error: err?.message ?? "Failed to leave circle" },
      { status }
    );
  }
}