import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { EventClaim, Event } from "@/lib/types/event";
import { getSessionUser } from "@/lib/firebase/server-auth";

/**
 * GET /api/events/my-claims
 * Get all reward claims (transaction history) for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const claimsRef = collection(db, "event_claims");
    const q = query(
      claimsRef,
      where("userId", "==", user.uid),
      where("status", "==", "awarded"),
    );

    const snapshot = await getDocs(q);

    const results: (EventClaim & { event?: Event })[] = [];

    for (const claimDoc of snapshot.docs) {
      const claim = claimDoc.data() as EventClaim;

      // Fetch the event details
      const eventDoc = await getDoc(doc(db, "events", claim.eventId));
      const event = eventDoc.exists()
        ? (eventDoc.data() as Event)
        : undefined;

      results.push({
        ...claim,
        id: claimDoc.id,
        event,
      });
    }

    // Sort by most recent
    results.sort(
      (a, b) => b.createdAt.toMillis() - a.createdAt.toMillis(),
    );

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error fetching reward claims:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch reward claims",
      },
      { status: 500 },
    );
  }
}
