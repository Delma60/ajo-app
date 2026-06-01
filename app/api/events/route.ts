import { NextRequest, NextResponse } from "next/server";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Event } from "@/lib/types/event";

/**
 * GET /api/events
 * List all active public events for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const now = Timestamp.now();
    const eventsRef = collection(db, "events");
    const q = query(
      eventsRef,
      where("status", "==", "active"),
      where("startDate", "<=", now),
      where("endDate", ">=", now),
    );

    const snapshot = await getDocs(q);
    const events = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
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
