import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { invalidateCache } from "@/lib/services/settings-service";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/types/admin-settings";

// ─── Route segment config ─────────────────────────────────────────────────────
// Allow large file uploads for APK and IPA files (5 min timeout).
export const config = {
  maxDuration: 300,
};

const SESSION_COOKIE = "__session";
const SETTINGS_COLLECTION = "admin_config";
const SETTINGS_DOC = "platform_settings";

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
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

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
    console.error("[GET /api/admin/app-distribution]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to load app distribution info" },
      { status: 500 },
    );
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
    // Parse FormData with large file support
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseErr) {
      console.error("[POST /api/admin/app-distribution] FormData parse error:", parseErr);
      return NextResponse.json(
        { success: false, data: null, error: "Failed to parse upload. File may be too large or request malformed." },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    const platform = String(formData.get("platform") || "").toLowerCase();
    const version = String(formData.get("version") || "").trim();
    const releaseNotes = String(formData.get("releaseNotes") || "").trim();

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, data: null, error: "No file provided" },
        { status: 400 },
      );
    }

    if (platform !== "android" && platform !== "ios") {
      return NextResponse.json(
        { success: false, data: null, error: "Invalid platform" },
        { status: 400 },
      );
    }

    const originalName = file.name || "app-package";
    const requiredExt = platform === "android" ? ".apk" : ".ipa";
    if (!originalName.toLowerCase().endsWith(requiredExt)) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: `Upload must be a ${requiredExt} file for ${platform}`,
        },
        { status: 400 },
      );
    }

    const downloadsDir = path.join(process.cwd(), "public", "downloads");
    await fs.promises.mkdir(downloadsDir, { recursive: true });

    const savedName = platform === "android" ? "ajosave-android.apk" : "ajosave-ios.ipa";
    const savedPath = path.join(downloadsDir, savedName);

    // Write file to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(savedPath, buffer);

    console.log(`[POST /api/admin/app-distribution] Successfully uploaded ${savedName} (${buffer.length} bytes)`);

    const downloadUrl = `/downloads/${savedName}`;
    const metadataUpdate = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
      updatedByName: admin.name,
      appDistribution: {
        [platform]: {
          enabled: true,
          version: version || "latest",
          fileName: savedName,
          downloadUrl,
          releaseNotes,
          lastUploadedAt: FieldValue.serverTimestamp(),
        },
      },
    };

    const settingsRef = adminDb
      .collection(SETTINGS_COLLECTION)
      .doc(SETTINGS_DOC);

    await settingsRef.set(metadataUpdate, { merge: true });
    invalidateCache();

    return NextResponse.json({
      success: true,
      data: {
        appDistribution: {
          [platform]: {
            enabled: true,
            version: version || "latest",
            fileName: savedName,
            downloadUrl,
            releaseNotes,
            lastUploadedAt: new Date().toISOString(),
          },
        },
      },
      error: null,
    });
  } catch (err) {
    console.error("[POST /api/admin/app-distribution]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to upload app binary" },
      { status: 500 },
    );
  }
}
