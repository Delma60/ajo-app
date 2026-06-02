import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { SupportService } from "@/lib/services/support-service";

const SESSION_COOKIE = "__session";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore?.get?.(SESSION_COOKIE)?.value ?? null;
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

export async function GET() {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    }

    const service = new SupportService();
    const stats = await service.getAdminStats();

    return NextResponse.json({ success: true, data: stats });
  } catch (error: unknown) {
    console.error("[api/admin/support/stats/GET]", error);
    return NextResponse.json({ success: false, data: null, error: "Failed to load support stats" }, { status: 500 });
  }
}
