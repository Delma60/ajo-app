import { NextRequest, NextResponse } from "next/server";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { Event } from "@/lib/types/event";
import { getSessionUser } from "@/lib/firebase/auth";

/**
 * GET /api/admin/events/[id]
 * Get full event details with stats (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const eventDoc = await getDoc(doc(adminDb, "events", params.id));

    if (!eventDoc.exists()) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404 },
      );
    }

    const event = {
      id: eventDoc.id,
      ...eventDoc.data(),
    } as Event;

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch event",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/events/[id]
 * Update event (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const body = await request.json();

    const updateData: Partial<Event> = {
      updatedAt: Timestamp.now(),
    };

    // Only allow updating certain fields
    if (body.title) updateData.title = body.title;
    if (body.description) updateData.description = body.description;
    if (body.status) updateData.status = body.status;
    if (body.conditions) updateData.conditions = body.conditions;

    await updateDoc(doc(adminDb, "events", params.id), updateData);

    const updatedDoc = await getDoc(doc(adminDb, "events", params.id));
    const updated = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as Event;

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update event",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/events/[id]
 * Delete event (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    await deleteDoc(doc(adminDb, "events", params.id));

    return NextResponse.json({
      success: true,
      data: null,
    });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete event",
      },
      { status: 500 },
    );
  }
}
