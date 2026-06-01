import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { SupportService } from "@/lib/services/support-service";

const SESSION_COOKIE = "__session";

async function verifyAdmin() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
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

export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const category = url.searchParams.get("category") || undefined;
    const assignedTo = url.searchParams.get("assignedTo") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);

    const service = new SupportService();
    const tickets = await service.listAdminTickets({
      status: status as any,
      category: category as any,
      assignedTo: assignedTo || undefined,
      search,
      limit,
    });

    return NextResponse.json({ success: true, data: tickets });
  } catch (error: unknown) {
    console.error("[api/admin/support/GET]", error);
    return NextResponse.json({ success: false, data: null, error: "Failed to load support tickets" }, { status: 500 });
  }
}
