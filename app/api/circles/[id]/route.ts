import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { CircleService } from "@/lib/services/circle-service";
import type { Circle } from "@/lib/types/circle";

const SESSION_COOKIE = "__session";

async function getSessionUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) {
    console.log("[GET /api/circles/[id]] no session cookie");
    return null;
  }
  try {
    console.log("[GET /api/circles/[id]] verifying session cookie");
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch (err) {
    console.error("[GET /api/circles/[id]] session verify failed", err);
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
    console.log(`[GET /api/circles/[id]] request for id=${id}`);
    const doc = await adminDb.collection("circles").doc(id).get();

    if (!doc.exists) {
      console.log(`[GET /api/circles/[id]] circle not found id=${id}`);
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
    const { action, invitePermission } = body as {
      action?: string;
      invitePermission?: string;
    };

    const service = new CircleService();
    let circle;

    if (invitePermission !== undefined && action !== undefined) {
      return Response.json(
        {
          success: false,
          data: null,
          error: "Please submit either an action or invitePermission, not both.",
        },
        { status: 400 }
      );
    }

    if (invitePermission !== undefined) {
      if (!["admin", "members"].includes(invitePermission)) {
        return Response.json(
          {
            success: false,
            data: null,
            error: "Invalid invite permission",
          },
          { status: 400 }
        );
      }
      circle = await service.updateInvitePermission(
        id,
        sessionUser.uid,
        invitePermission as Circle["invitePermission"],
      );
    } else {
      if (!action || !["pause", "unpause"].includes(action)) {
        return Response.json(
          { success: false, data: null, error: "Invalid action" },
          { status: 400 }
        );
      }

      if (action === "pause") {
        circle = await service.pauseCircle(id, sessionUser.uid);
      } else {
        circle = await service.unpauseCircle(id, sessionUser.uid);
      }
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

// DELETE /api/circles/[id] — circle admin or platform admin
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

    // Check if user is circle admin or platform admin
    const isCircleAdmin = doc.data()?.adminId === sessionUser.uid;
    
    // Check if user is a platform admin
    const userDoc = await adminDb.collection("users").doc(sessionUser.uid).get();
    const isPlatformAdmin = userDoc.exists && userDoc.data()?.role === "admin";

    if (!isCircleAdmin && !isPlatformAdmin) {
      return Response.json(
        { success: false, data: null, error: "Only the circle admin or platform admin can cancel a circle" },
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