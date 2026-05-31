import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import {
  calculateTrustScore,
  getTrustTier,
  TRUST_WEIGHTS,
} from "@/lib/services/trust-score-service";

const SESSION_COOKIE = "__session";

async function getSessionUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}

/**
 * GET /api/circles/[id]/trust-score
 *
 * Returns the full trust score breakdown for a circle including:
 * - current score and tier
 * - payment counts (on-time, late, missed)
 * - score deltas per event type
 * - recent score-affecting events (last 10 contributions)
 * - projected score if remaining cycles are paid on time
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id: circleId } = await params;

    const circleSnap = await adminDb.collection("circles").doc(circleId).get();
    if (!circleSnap.exists) {
      return Response.json(
        { success: false, data: null, error: "Circle not found" },
        { status: 404 }
      );
    }

    const circle = circleSnap.data()!;

    // Verify the caller is a member or admin
    const isMember = (circle.memberIds as string[]).includes(sessionUser.uid);
    const isAdmin = circle.adminId === sessionUser.uid;
    if (!isMember && !isAdmin) {
      return Response.json(
        { success: false, data: null, error: "Access denied" },
        { status: 403 }
      );
    }

    const breakdown = circle.trustScoreBreakdown ?? {
      onTimePayments: 0,
      latePayments: 0,
      missedPayments: 0,
      lastUpdated: null,
    };

    const score = circle.trustScore as number ?? 100;
    const tier = getTrustTier(score);

    // Total completed contribution slots
    const totalContributions =
      breakdown.onTimePayments + breakdown.latePayments + breakdown.missedPayments;

    // Remaining cycles for this circle
    const remainingCycles = Math.max(
      0,
      (circle.totalCycles as number) - (circle.currentCycle as number) + 1
    );
    const remainingSlots = remainingCycles * (circle.memberIds as string[]).length;

    // Projected score if all remaining contributions are on time
    const projectedScore = calculateTrustScore({
      onTimePayments: breakdown.onTimePayments + remainingSlots,
      latePayments: breakdown.latePayments,
      missedPayments: breakdown.missedPayments,
    });

    // Fetch recent score-affecting contribution events
    const [recentLate, recentMissed, recentOnTime] = await Promise.all([
      adminDb
        .collection("contributions")
        .where("circleId", "==", circleId)
        .where("status", "==", "late")
        .orderBy("updatedAt", "desc")
        .limit(5)
        .get(),
      adminDb
        .collection("contributions")
        .where("circleId", "==", circleId)
        .where("status", "==", "missed")
        .orderBy("updatedAt", "desc")
        .limit(5)
        .get(),
      adminDb
        .collection("contributions")
        .where("circleId", "==", circleId)
        .where("status", "==", "paid")
        .orderBy("paidAt", "desc")
        .limit(5)
        .get(),
    ]);

    type ScoreEvent = {
      type: "on_time" | "late" | "missed";
      userId: string;
      cycle: number;
      delta: number;
      timestamp: string | null;
    };

    const events: ScoreEvent[] = [
      ...recentOnTime.docs
        .filter((d) => !d.data().penaltyAmount) // exclude paid-late
        .map((d) => ({
          type: "on_time" as const,
          userId: d.data().userId as string,
          cycle: d.data().cycle as number,
          delta: TRUST_WEIGHTS.ON_TIME,
          timestamp: d.data().paidAt?.toDate?.()?.toISOString() ?? null,
        })),
      ...recentLate.docs.map((d) => ({
        type: "late" as const,
        userId: d.data().userId as string,
        cycle: d.data().cycle as number,
        delta: TRUST_WEIGHTS.LATE,
        timestamp: d.data().updatedAt?.toDate?.()?.toISOString() ?? null,
      })),
      ...recentMissed.docs.map((d) => ({
        type: "missed" as const,
        userId: d.data().userId as string,
        cycle: d.data().cycle as number,
        delta: TRUST_WEIGHTS.MISSED,
        timestamp: d.data().updatedAt?.toDate?.()?.toISOString() ?? null,
      })),
    ]
      .sort((a, b) => {
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      })
      .slice(0, 10);

    return Response.json({
      success: true,
      data: {
        circleId,
        score,
        tier: {
          label: tier.label,
          color: tier.color,
          badgeCls: tier.badgeCls,
          dotCls: tier.dotCls,
        },
        breakdown: {
          onTimePayments: breakdown.onTimePayments,
          latePayments: breakdown.latePayments,
          missedPayments: breakdown.missedPayments,
          totalContributions,
          lastUpdated: breakdown.lastUpdated?.toDate?.()?.toISOString() ?? null,
        },
        weights: TRUST_WEIGHTS,
        projectedScore,
        remainingCycles,
        events,
      },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/circles/[id]/trust-score]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to fetch trust score" },
      { status: 500 }
    );
  }
}