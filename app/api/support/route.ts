import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { SupportService } from "@/lib/services/support-service";
import { createSupportTicketSchema } from "@/lib/validators/support";

const SESSION_COOKIE = "__session";

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const service = new SupportService();
    const tickets = await service.listTicketsForUser(decoded.uid);

    return NextResponse.json({ success: true, data: tickets });
  } catch (error: unknown) {
    console.error("[api/support/GET]", error);
    return NextResponse.json({ success: false, data: null, error: "Failed to load support tickets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionCookie) {
      return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const body = await request.json();
    const parseResult = createSupportTicketSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ success: false, data: null, error: parseResult.error.flatten().formErrors.join(", ") }, { status: 400 });
    }

    const service = new SupportService();
    const ticket = await service.createTicket({
      userId: decoded.uid,
      subject: parseResult.data.subject,
      category: parseResult.data.category,
      priority: parseResult.data.priority,
      initialMessage: parseResult.data.message,
      screenshotUrl: parseResult.data.screenshotUrl,
    });

    return NextResponse.json({ success: true, data: ticket }, { status: 201 });
  } catch (error: any) {
    console.error("[api/support/POST]", error);
    if (error.name === "SupportError") {
      return NextResponse.json({ success: false, data: null, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: false, data: null, error: error.message ?? "Internal server error" }, { status: 500 });
  }
}
