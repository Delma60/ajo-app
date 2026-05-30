import { NextRequest } from "next/server";
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

function serializeCircle(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data()!;
  return {
    id: doc.id,
    ...data,
    goal: data.contribution * data.maxMembers,
    nextDueDate: data.nextDueDate?.toDate?.()?.toISOString() ?? null,
    nextPayoutDate: data.nextPayoutDate?.toDate?.()?.toISOString() ?? null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
  };
}

// GET /api/circles/[id]
export async function GET(
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
    const doc = await adminDb.collection("circles").doc(id).get();

    if (!doc.exists) {
      return Response.json(
        { success: false, data: null, error: "Circle not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: serializeCircle(doc),
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/circles/[id]]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to fetch circle" },
      { status: 500 }
    );
  }
}

// PATCH /api/circles/[id] — pause/unpause (admin only)
export async function PATCH(
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
    const body = await request.json();
    const { action } = body; // "pause" | "unpause"

    if (!action || !["pause", "unpause"].includes(action)) {
      return Response.json(
        { success: false, data: null, error: "Invalid action" },
        { status: 400 }
      );
    }

    const service = new CircleService();
    let circle;
    if (action === "pause") {
      circle = await service.pauseCircle(id, sessionUser.uid);
    } else {
      circle = await service.unpauseCircle(id, sessionUser.uid);
    }

    return Response.json({ success: true, data: circle, error: null });
  } catch (err: any) {
    console.error("[PATCH /api/circles/[id]]", err);
    return Response.json(
      {
        success: false,
        data: null,
        error: err?.message ?? "Failed to update circle",
      },
      { status: err?.code ? 400 : 500 }
    );
  }
}

// DELETE /api/circles/[id] — admin only
export async function DELETE(
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
    const doc = await adminDb.collection("circles").doc(id).get();

    if (!doc.exists) {
      return Response.json(
        { success: false, data: null, error: "Circle not found" },
        { status: 404 }
      );
    }

    if (doc.data()?.adminId !== sessionUser.uid) {
      return Response.json(
        { success: false, data: null, error: "Only the admin can delete a circle" },
        { status: 403 }
      );
    }

    await adminDb.collection("circles").doc(id).update({
      status: "cancelled",
      updatedAt: new Date(),
    });

    return Response.json({ success: true, data: null, error: null });
  } catch (err) {
    console.error("[DELETE /api/circles/[id]]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to delete circle" },
      { status: 500 }
    );
  }
}