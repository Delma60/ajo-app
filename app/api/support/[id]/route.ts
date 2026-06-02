import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { SupportService } from "@/lib/services/support-service";

const SESSION_COOKIE = "__session";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    }

    const params = await context.params;
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const service = new SupportService();
    const ticket = await service.getTicket(params.id, decoded.uid);

    return NextResponse.json({ success: true, data: ticket });
  } catch (error: any) {
    console.error("[api/support/[id]/GET]", error);
    if (error.name === "SupportError") {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ success: false, data: null, error: error.message }, { status });
    }
    return NextResponse.json({ success: false, data: null, error: "Failed to load ticket" }, { status: 500 });
  }
}
