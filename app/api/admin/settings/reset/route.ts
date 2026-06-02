// app/api/admin/settings/reset/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/types/admin-settings";
import { invalidateCache } from "@/lib/services/settings-service";

const SESSION_COOKIE = "__session";
const SETTINGS_DOC = "platform_settings";
const SETTINGS_COLLECTION = "admin_config";

async function getAdminUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== "admin") return null;
    return {
      uid: decoded.uid,
      name: (userSnap.data()?.name as string) ?? "Admin",
      email: (userSnap.data()?.email as string) ?? "",
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    if (body?.action !== "reset") {
      return NextResponse.json(
        { success: false, data: null, error: "Invalid action" },
        { status: 400 },
      );
    }

    const settingsRef = adminDb
      .collection(SETTINGS_COLLECTION)
      .doc(SETTINGS_DOC);

    await settingsRef.set({
      ...DEFAULT_PLATFORM_SETTINGS,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
      updatedByName: admin.name,
      isReset: true,
    });

    // Invalidate server-side cache so new settings are picked up immediately
    invalidateCache();

    return NextResponse.json({
      success: true,
      data: { ...DEFAULT_PLATFORM_SETTINGS },
      error: null,
    });
  } catch (err) {
    console.error("[POST /api/admin/settings/reset]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to reset settings" },
      { status: 500 },
    );
  }
}
