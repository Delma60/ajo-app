import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { SupportService } from "@/lib/services/support-service";
import { addSupportMessageSchema } from "@/lib/validators/support";

const SESSION_COOKIE = "__session";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const body = await request.json();
    const parseResult = addSupportMessageSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ success: false, data: null, error: parseResult.error.flatten().formErrors.join(", ") }, { status: 400 });
    }

    const service = new SupportService();
    await service.addMessage({
      ticketId: params.id,
      senderId: decoded.uid,
      senderRole: "user",
      text: parseResult.data.text,
      isInternal: false,
      attachmentUrl: parseResult.data.attachmentUrl,
    });

    return NextResponse.json({ success: true, data: null });
  } catch (error: any) {
    console.error("[api/support/[id]/messages/POST]", error);
    if (error.name === "SupportError") {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ success: false, data: null, error: error.message }, { status });
    }
    return NextResponse.json({ success: false, data: null, error: "Failed to send message" }, { status: 500 });
  }
}
