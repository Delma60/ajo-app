import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { EventClaim } from "@/lib/types/event";
import { getSessionUser } from "@/lib/firebase/server-auth";

/**
 * GET /api/events/[id]/claim-status
 * Check if the current user has already claimed a specific event
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id: eventId } = await params;

    const snapshot = await adminDb
      .collection("event_claims")
      .where("eventId", "==", eventId)
      .where("userId", "==", user.uid)
      .get();

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
