// app/api/admin/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { PlatformSettings } from "@/lib/types/admin-settings";
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

/**
 * GET /api/admin/settings
 * Returns the current platform settings, falling back to defaults if not yet saved.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const snap = await adminDb
      .collection(SETTINGS_COLLECTION)
      .doc(SETTINGS_DOC)
      .get();

    if (!snap.exists) {
      // First time: return defaults (don't auto-create)
      return NextResponse.json({
        success: true,
        data: {
          ...DEFAULT_PLATFORM_SETTINGS,
          updatedAt: null,
          updatedBy: null,
          isDefault: true,
        },
        error: null,
      });
    }

    const data = snap.data()!;
    const responseData = {
      ...DEFAULT_PLATFORM_SETTINGS,
      ...data,
      appDistribution: {
        ...DEFAULT_PLATFORM_SETTINGS.appDistribution,
        ...(data.appDistribution || {}),
        android: {
          ...DEFAULT_PLATFORM_SETTINGS.appDistribution.android,
          ...(data.appDistribution?.android || {}),
          lastUploadedAt:
            data.appDistribution?.android?.lastUploadedAt?.toDate?.()?.toISOString() ??
            data.appDistribution?.android?.lastUploadedAt ??
            null,
        },
        ios: {
          ...DEFAULT_PLATFORM_SETTINGS.appDistribution.ios,
          ...(data.appDistribution?.ios || {}),
          lastUploadedAt:
            data.appDistribution?.ios?.lastUploadedAt?.toDate?.()?.toISOString() ??
            data.appDistribution?.ios?.lastUploadedAt ??
            null,
        },
      },
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      isDefault: false,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/admin/settings]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/settings
 * Body: { section: string, updates: Partial<SectionSettings> }
 * Merges the given section's updates into the stored document.
 */
export async function PATCH(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { section, updates } = body;

    const validSections = [
      "general",
      "wallet",
      "circles",
      "payouts",
      "investments",
      "trustScore",
      "notifications",
      "maintenance",
      "appDistribution",
    ];

    if (!section || !validSections.includes(section)) {
      return NextResponse.json(
        { success: false, data: null, error: "Invalid or missing section" },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== "object") {
      return NextResponse.json(
        { success: false, data: null, error: "Invalid updates payload" },
        { status: 400 }
      );
    }

    // Deep merge: create nested section object with updates
    const firestoreUpdate: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
      updatedByName: admin.name,
      [section]: {},
    };

    for (const [key, value] of Object.entries(updates)) {
      (firestoreUpdate[section] as Record<string, unknown>)[key] = value;
    }

    const settingsRef = adminDb
      .collection(SETTINGS_COLLECTION)
      .doc(SETTINGS_DOC);

    // Use set with merge to handle first-time creation
    await settingsRef.set(firestoreUpdate, { merge: true });

    // Fetch & return updated doc
    const updated = await settingsRef.get();

    // Write audit log
    const auditRef = adminDb
      .collection(SETTINGS_COLLECTION)
      .doc(SETTINGS_DOC)
      .collection("audit_log")
      .doc();

    await auditRef.set({
      id: auditRef.id,
      adminId: admin.uid,
      adminName: admin.name,
      section,
      changes: updates,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Invalidate server-side cache so new settings are picked up immediately
    invalidateCache();

    return NextResponse.json({
      success: true,
      data: {
        ...updated.data(),
        updatedAt: new Date().toISOString(),
      },
      error: null,
    });
  } catch (err) {
    console.error("[PATCH /api/admin/settings]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
