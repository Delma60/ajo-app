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
import { EventClaim, UserBadge, Badge } from "@/lib/types/event";
import { getSessionUser } from "@/lib/firebase/auth";

/**
 * GET /api/events/my-badges
 * Get all badges earned by the current user
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

    const badgesRef = collection(
      db,
      `users/${user.uid}/earned_badges`,
    );
    const snapshot = await getDocs(badgesRef);

    const results: (UserBadge & Badge)[] = [];

    for (const badgeDoc of snapshot.docs) {
      const userBadge = badgeDoc.data() as UserBadge;

      // Fetch the badge definition
      if (userBadge.badgeId) {
        const badgeDef = await getDoc(doc(db, "badges", userBadge.badgeId));
        if (badgeDef.exists()) {
          results.push({
            ...userBadge,
            ...(badgeDef.data() as Badge),
          });
        }
      }
    }

    // Sort by most recently earned
    results.sort(
      (a, b) => b.earnedAt.toMillis() - a.earnedAt.toMillis(),
    );

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error fetching badges:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch badges",
      },
      { status: 500 },
    );
  }
}
