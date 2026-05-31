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
    return decoded;
  } catch {
    return null;
  }
}

/**
 * PATCH /api/admin/transactions/[id]
 * Body: { status: "pending" | "success" | "failed" | "cancelled" }
 * Only allows status update by admin.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing transaction id" }, { status: 400 });
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = ["pending", "success", "failed", "cancelled"];
  if (!body.status || !allowed.includes(body.status)) {
    return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
  }

  try {
    const txRef = adminDb.collection("transactions").doc(id);
    await txRef.update({ status: body.status, updatedAt: new Date() });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}
