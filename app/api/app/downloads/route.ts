import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/types/admin-settings";

const SETTINGS_COLLECTION = "admin_config";
const SETTINGS_DOC = "platform_settings";

function normalizeTimestamp(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const snap = await adminDb
      .collection(SETTINGS_COLLECTION)
      .doc(SETTINGS_DOC)
      .get();

    const raw = snap.exists ? (snap.data() as any) : {};
    const appDistribution = {
      ...DEFAULT_PLATFORM_SETTINGS.appDistribution,
      ...(raw.appDistribution || {}),
      android: {
        ...DEFAULT_PLATFORM_SETTINGS.appDistribution.android,
        ...(raw.appDistribution?.android || {}),
        lastUploadedAt: normalizeTimestamp(raw.appDistribution?.android?.lastUploadedAt),
      },
      ios: {
        ...DEFAULT_PLATFORM_SETTINGS.appDistribution.ios,
        ...(raw.appDistribution?.ios || {}),
        lastUploadedAt: normalizeTimestamp(raw.appDistribution?.ios?.lastUploadedAt),
      },
    };

    return NextResponse.json({ success: true, data: { appDistribution }, error: null });
  } catch (err) {
    console.error("[GET /api/app/downloads]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Unable to load download info" },
      { status: 500 },
    );
  }
}
