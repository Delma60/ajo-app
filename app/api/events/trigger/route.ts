import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { evaluateAndAward } from "@/lib/services/event-service";

const SESSION_COOKIE = "__session";

async function getSessionUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const triggerType = body?.triggerType as string | undefined;
    const triggerData = body?.triggerData ?? {};

    if (!triggerType) {
      return NextResponse.json({ success: false, error: "Missing triggerType" }, { status: 400 });
    }

    // Fire-and-forget evaluation
    try {
      void evaluateAndAward(sessionUser.uid, triggerType as any, triggerData);
    } catch (err) {
      console.error("Failed to evaluateAndAward via trigger API:", err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/events/trigger]", err);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
