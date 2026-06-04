import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { EventClaim } from "@/lib/types/event";
import { getSessionUser } from "@/lib/firebase/server-auth";

/**
 * GET /api/admin/events/[id]/claims
 * Get all claims for a specific event (admin only)
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

    if (user.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const { id: eventId } = await params;

    const snapshot = await adminDb
      .collection("event_claims")
      .where("eventId", "==", eventId)
      .get();

    const claims = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as EventClaim[];

    const uniqueUserIds = Array.from(
      new Set(claims.map((claim) => claim.userId)),
    );

    const userDocs = await Promise.all(
      uniqueUserIds.map((userId) =>
        adminDb.collection("users").doc(userId).get(),
      ),
    );

    const userNameById = new Map<string, string>();
    userDocs.forEach((userDoc, index) => {
      const userData = userDoc.data();
      if (userData) {
        userNameById.set(
          uniqueUserIds[index],
          (userData as { name?: string }).name || uniqueUserIds[index],
        );
      } else {
        userNameById.set(uniqueUserIds[index], uniqueUserIds[index]);
      }
    });

    const enrichedClaims = claims.map((claim) => ({
      ...claim,
      userName: userNameById.get(claim.userId) ?? claim.userId,
    }));

    // Pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedClaims = enrichedClaims.slice(start, end);

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
