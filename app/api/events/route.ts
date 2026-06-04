import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Event } from "@/lib/types/event";
import { parseTimestamp } from "@/lib/utils";

/**
 * GET /api/events
 * List all active public events for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const now = Timestamp.now();
    const eventsRef = adminDb.collection("events");
    const snapshot = await eventsRef.where("status", "==", "active").get();

    const events = snapshot.docs
      .map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          ...data,
        };
      })
      .filter((event) => {
        const startDate = parseTimestamp(event.startDate);
        const endDate = parseTimestamp(event.endDate);
        return (
          startDate !== null &&
          endDate !== null &&
          startDate.getTime() <= now.toMillis() &&
          endDate.getTime() >= now.toMillis()
        );
      })
      .map((event) => ({
        ...event,
        startDate: parseTimestamp(event.startDate)?.toISOString() ?? event.startDate,
        endDate: parseTimestamp(event.endDate)?.toISOString() ?? event.endDate,
        createdAt:
          typeof event.createdAt?.toDate === "function"
            ? event.createdAt.toDate().toISOString()
            : event.createdAt,
        updatedAt:
          typeof event.updatedAt?.toDate === "function"
            ? event.updatedAt.toDate().toISOString()
            : event.updatedAt,
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
