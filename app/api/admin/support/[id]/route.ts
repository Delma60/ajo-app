import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { SupportService } from "@/lib/services/support-service";
import { updateSupportTicketSchema } from "@/lib/validators/support";

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

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const service = new SupportService();
    const ticket = await service.getTicket(params.id, admin.uid);

    const userSnap = await adminDb.collection("users").doc(ticket.userId).get();
    const user = userSnap.exists ? { id: userSnap.id, ...userSnap.data() } : null;

    return NextResponse.json({ success: true, data: { ticket, user } });
  } catch (error: any) {
    console.error("[api/admin/support/[id]/GET]", error);
    const status = error.name === "SupportError" ? (error.code === "NOT_FOUND" ? 404 : 403) : 500;
    return NextResponse.json({ success: false, data: null, error: error.message ?? "Failed to load ticket" }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    }
    const params = await context.params;
    const body = await request.json();
    const parseResult = updateSupportTicketSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ success: false, data: null, error: parseResult.error.flatten().formErrors.join(", ") }, { status: 400 });
    }

    const service = new SupportService();
    const ticket = await service.updateTicket(params.id, admin.uid, {
      status: parseResult.data.status,
      priority: parseResult.data.priority,
      assignedTo: parseResult.data.assignedTo ?? null,
    });

    return NextResponse.json({ success: true, data: ticket });
  } catch (error: any) {
    console.error("[api/admin/support/[id]/PATCH]", error);
    if (error.name === "SupportError") {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ success: false, data: null, error: error.message }, { status });
    }
    return NextResponse.json({ success: false, data: null, error: "Failed to update ticket" }, { status: 500 });
  }
}
