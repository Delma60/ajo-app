import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

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

// PATCH /api/notifications/[id] — mark single notification as read
export async function PATCH(
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

    const { id } = await params;
    const notifRef = adminDb.collection("notifications").doc(id);
    const notifSnap = await notifRef.get();

    if (!notifSnap.exists) {
      return Response.json(
        { success: false, data: null, error: "Notification not found" },
        { status: 404 }
      );
    }

    // Ensure the notification belongs to the authenticated user
    if (notifSnap.data()?.userId !== sessionUser.uid) {
      return Response.json(
        { success: false, data: null, error: "Forbidden" },
        { status: 403 }
      );
    }

    await notifRef.update({ read: true });

    return Response.json({ success: true, data: null, error: null });
  } catch (err) {
    console.error("[PATCH /api/notifications/[id]]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to mark notification as read" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/[id] — delete a notification
export async function DELETE(
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

    const { id } = await params;
    const notifRef = adminDb.collection("notifications").doc(id);
    const notifSnap = await notifRef.get();

    if (!notifSnap.exists) {
      return Response.json(
        { success: false, data: null, error: "Notification not found" },
        { status: 404 }
      );
    }

    if (notifSnap.data()?.userId !== sessionUser.uid) {
      return Response.json(
        { success: false, data: null, error: "Forbidden" },
        { status: 403 }
      );
    }

    await notifRef.delete();

    return Response.json({ success: true, data: null, error: null });
  } catch (err) {
    console.error("[DELETE /api/notifications/[id]]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}