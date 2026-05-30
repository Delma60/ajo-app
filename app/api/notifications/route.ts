import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

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

// PATCH /api/notifications — mark all as read for the authenticated user
export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const snap = await adminDb
      .collection("notifications")
      .where("userId", "==", sessionUser.uid)
      .where("read", "==", false)
      .get();

    if (snap.empty) {
      return Response.json({ success: true, data: { count: 0 }, error: null });
    }

    const batch = adminDb.batch();
    snap.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();

    return Response.json({
      success: true,
      data: { count: snap.size },
      error: null,
    });
  } catch (err) {
    console.error("[PATCH /api/notifications]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}

// GET /api/notifications — fetch paginated notifications (optional server-side use)
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const snap = await adminDb
      .collection("notifications")
      .where("userId", "==", sessionUser.uid)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const data = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? null,
    }));

    return Response.json({ success: true, data, error: null });
  } catch (err) {
    console.error("[GET /api/notifications]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}