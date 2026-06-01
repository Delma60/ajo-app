import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const SESSION_COOKIE = "__session";

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

export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const res = await fetch("https://api.ipify.org?format=json");
    if (!res.ok) {
      throw new Error("Failed to fetch public IP");
    }

    const payload = await res.json();
    const ip = typeof payload?.ip === "string" ? payload.ip : null;
    if (!ip) {
      throw new Error("Invalid IP response");
    }

    return NextResponse.json({ success: true, data: { ip }, error: null });
  } catch (err) {
    console.error("[GET /api/admin/server-ip]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to resolve server IP" },
      { status: 500 },
    );
  }
}
