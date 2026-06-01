import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const SESSION_COOKIE = "__session";

async function getAdminUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * PATCH /api/admin/notifications/[id]
 * Body: { read: boolean }
 * Toggle read status of a single notification.
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

    const notifRef = adminDb.collection("notifications").doc(id);
    const notifSnap = await notifRef.get();

    if (!notifSnap.exists) {
      return NextResponse.json(
        { success: false, data: null, error: "Notification not found" },
        { status: 404 }
      );
    }

    await notifRef.update({
      read: body.read === true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, data: null, error: null });
  } catch (err) {
    console.error("[PATCH /api/admin/notifications/[id]]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to update notification" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/notifications/[id]
 * Hard-delete a single notification (admin-only).
 */
export async function DELETE(
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
    const notifRef = adminDb.collection("notifications").doc(id);
    const notifSnap = await notifRef.get();

    if (!notifSnap.exists) {
      return NextResponse.json(
        { success: false, data: null, error: "Notification not found" },
        { status: 404 }
      );
    }

    await notifRef.delete();

    return NextResponse.json({ success: true, data: null, error: null });
  } catch (err) {
    console.error("[DELETE /api/admin/notifications/[id]]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}