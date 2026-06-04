import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { CircleService } from "@/lib/services/circle-service";

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

async function isPlatformAdmin(uid: string) {
  const userSnap = await adminDb.collection("users").doc(uid).get();
  return userSnap.exists && userSnap.data()?.role === "admin";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action, memberId } = body as {
      action?: string;
      memberId?: string;
    };

    if (!action || !["pause", "resume", "shift"].includes(action)) {
      return NextResponse.json(
        { success: false, data: null, error: "Invalid action" },
        { status: 400 }
      );
    }
    if (!memberId) {
      return NextResponse.json(
        { success: false, data: null, error: "Member ID is required" },
        { status: 400 }
      );
    }

    const circleSnap = await adminDb.collection("circles").doc(id).get();
    if (!circleSnap.exists) {
      return NextResponse.json(
        { success: false, data: null, error: "Circle not found" },
        { status: 404 }
      );
    }

    const isAdmin = await isPlatformAdmin(sessionUser.uid);
    const service = new CircleService();
    let circle;

    if (action === "pause") {
      circle = await service.pauseMember(
        id,
        memberId,
        sessionUser.uid,
        isAdmin
      );
    } else if (action === "resume") {
      circle = await service.resumeMember(
        id,
        memberId,
        sessionUser.uid,
        isAdmin
      );
    } else {
      circle = await service.shiftMember(
        id,
        memberId,
        sessionUser.uid,
        isAdmin
      );
    }

    return NextResponse.json({ success: true, data: circle, error: null });
  } catch (err: any) {
    console.error(`[PATCH /api/circles/[id]/members]`, err);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: err?.message ?? "Failed to update member status",
      },
      { status: err?.code ? 400 : 500 }
    );
  }
}
