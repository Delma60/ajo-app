import { NextRequest, NextResponse } from "next/server";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { EventClaim } from "@/lib/types/event";

/**
 * GET /api/events/[id]/claim-status
 * Check if the current user has already claimed a specific event
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 },
      );
    }

    const { id: eventId } = await params;

    const claimsRef = collection(db, "event_claims");
    const q = query(
      claimsRef,
      where("eventId", "==", eventId),
      where("userId", "==", userId),
    );

    const snapshot = await getDocs(q);

    // Return true if user has any pending or awarded claim
    const hasClaimed = snapshot.docs.some((doc) => {
      const claim = doc.data() as EventClaim;
      return claim.status === "awarded" || claim.status === "pending";
    });

    return NextResponse.json({
      success: true,
      data: {
        claimed: hasClaimed,
        count: snapshot.size,
      },
    });
  } catch (error) {
    console.error("Error checking claim status:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to check claim status",
      },
      { status: 500 },
    );
  }
}
