import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { EventClaim } from "@/lib/types/event";
import { getSessionUser } from "@/lib/firebase/auth";

/**
 * GET /api/admin/events/[id]/claims
 * Get all claims for a specific event (admin only)
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const eventId = params.id;

    const claimsRef = collection(adminDb, "event_claims");
    const q = query(claimsRef, where("eventId", "==", eventId));

    const snapshot = await getDocs(q);
    const claims = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as EventClaim[];

    // Pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedClaims = claims.slice(start, end);

    // Stats
    const totalClaims = claims.length;
    const awardedClaims = claims.filter((c) => c.status === "awarded").length;
    const totalRewardKobo = claims
      .filter((c) => c.status === "awarded" && c.rewardAmountKobo)
      .reduce((sum, c) => sum + (c.rewardAmountKobo || 0), 0);

    return NextResponse.json({
      success: true,
      data: paginatedClaims,
      stats: {
        totalClaims,
        awardedClaims,
        totalRewardKobo,
        uniqueParticipants: new Set(claims.map((c) => c.userId)).size,
      },
      pagination: {
        page,
        limit,
        total: totalClaims,
        pages: Math.ceil(totalClaims / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching claims:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch claims",
      },
      { status: 500 },
    );
  }
}
