import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Event } from "@/lib/types/event";

/**
 * GET /api/events
 * List all active public events for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const now = Timestamp.now();
    const eventsRef = adminDb.collection("events");
    const snapshot = await eventsRef
      .where("status", "==", "active")
      .where("startDate", "<=", now)
      .where("endDate", ">=", now)
      .get();

    const events = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any),
    })) as Event[];

    return NextResponse.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch events",
      },
      { status: 500 },
    );
  }
}
