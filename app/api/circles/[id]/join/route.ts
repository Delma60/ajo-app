import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
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

// POST /api/circles/[id]/join
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    let inviteCode: string | undefined;

    try {
      const body = await request.json();
      inviteCode = body?.inviteCode;
    } catch {
      // Body is optional for public circles
    }

    const service = new CircleService();
    await service.joinCircle(id, sessionUser.uid, inviteCode);

    return Response.json({ success: true, data: null, error: null });
  } catch (err: any) {
    console.error("[POST /api/circles/[id]/join]", err);
    return Response.json(
      {
        success: false,
        data: null,
        error: err?.message ?? "Failed to join circle",
      },
      { status: err?.code ? 400 : 500 }
    );
  }
}