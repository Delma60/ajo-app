import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from "@/lib/types/user";

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

// GET /api/notifications/preferences — fetch current prefs
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userSnap = await adminDb.collection("users").doc(sessionUser.uid).get();
    if (!userSnap.exists) {
      return Response.json(
        { success: false, data: null, error: "User not found" },
        { status: 404 }
      );
    }

    const prefs: NotificationPrefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(userSnap.data()?.notificationPrefs ?? {}),
    };

    return Response.json({ success: true, data: prefs, error: null });
  } catch (err) {
    console.error("[GET /api/notifications/preferences]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications/preferences — update prefs
export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate that only known pref keys are present
    const allowedKeys = Object.keys(DEFAULT_NOTIFICATION_PREFS);
    const sanitized: Partial<NotificationPrefs> = {};
    for (const key of allowedKeys) {
      if (key in body && typeof body[key] === "boolean") {
        (sanitized as any)[key] = body[key];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return Response.json(
        { success: false, data: null, error: "No valid preference fields provided" },
        { status: 400 }
      );
    }

    // Merge with existing prefs rather than replacing entirely
    const userRef = adminDb.collection("users").doc(sessionUser.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return Response.json(
        { success: false, data: null, error: "User not found" },
        { status: 404 }
      );
    }

    const existing: NotificationPrefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(userSnap.data()?.notificationPrefs ?? {}),
    };

    const merged: NotificationPrefs = { ...existing, ...sanitized };

    await userRef.update({
      notificationPrefs: merged,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return Response.json({ success: true, data: merged, error: null });
  } catch (err) {
    console.error("[PATCH /api/notifications/preferences]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to save preferences" },
      { status: 500 }
    );
  }
}