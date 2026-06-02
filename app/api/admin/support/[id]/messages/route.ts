import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { SupportService } from "@/lib/services/support-service";
import { addSupportMessageSchema } from "@/lib/validators/support";

const SESSION_COOKIE = "__session";

async function verifyAdmin() {
  const cookieStore = await cookies();
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

export async function POST(
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
    const parseResult = addSupportMessageSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ success: false, data: null, error: parseResult.error.flatten().formErrors.join(", ") }, { status: 400 });
    }

    const service = new SupportService();
    await service.addMessage({
      ticketId: params.id,
      senderId: admin.uid,
      senderRole: "agent",
      text: parseResult.data.text,
      isInternal: parseResult.data.isInternal ?? false,
      attachmentUrl: parseResult.data.attachmentUrl,
    });

    return NextResponse.json({ success: true, data: null });
  } catch (error: any) {
    console.error("[api/admin/support/[id]/messages/POST]", error);
    if (error.name === "SupportError") {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ success: false, data: null, error: error.message }, { status });
    }
    return NextResponse.json({ success: false, data: null, error: "Failed to send message" }, { status: 500 });
  }
}
