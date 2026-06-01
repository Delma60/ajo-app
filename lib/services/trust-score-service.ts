/**
 * Trust Score Service
 *
 * Computes and persists a circle's trust score based on its members' contribution
 * history. The score is a single integer 0–100 that reflects how reliably the
 * circle's members pay on time.
 *
 * FORMULA
 * ───────
 *   base      = 100
 *   + on-time payments × WEIGHT_ON_TIME   (capped so score never exceeds 100)
 *   - late payments    × WEIGHT_LATE
 *   - missed payments  × WEIGHT_MISSED
 *   clamped to [0, 100]
 *
 * WEIGHTS
 * ───────
 *   On-time:  +2   (reward consistent payers)
 *   Late:     −5   (late but eventually paid)
 *   Missed:   −15  (never paid; most destructive)
 *
 * TIERS
 * ─────
 *   90–100  Excellent
 *   70–89   Good
 *   50–69   Fair
 *   25–49   Low
 *    0–24   At Risk
 *
 * USAGE
 * ─────
 * All writes go through this service so the formula stays in one place.
 * Call the helpers from circle-service.ts rather than writing raw FieldValue
 * increments scattered across the codebase.
 */

import { adminDb, admin } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getTrustScoreSettings } from "@/lib/services/settings-service";

// ─── Weights ──────────────────────────────────────────────────────────────────

// TRUST_WEIGHTS are now loaded from admin settings
// These are fallback values if needed, but calculateTrustScore expects
// weights to be passed from getTrustScoreSettings()
export const TRUST_WEIGHTS = {
  ON_TIME: 2,
  LATE: -5,
  MISSED: -15,
} as const;

// ─── Tier metadata (shared with client via a separate constants file) ─────────

export interface TrustTier {
  label: string;
  color: "emerald" | "blue" | "amber" | "orange" | "red";
  /** Tailwind badge classes for use in components */
  badgeCls: string;
  /** Tailwind dot/indicator classes */
  dotCls: string;
  minScore: number;
}

export const TRUST_TIERS: TrustTier[] = [
  {
    minScore: 90,
    label: "Excellent",
    color: "emerald",
    badgeCls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    dotCls: "bg-emerald-500",
  },
  {
    minScore: 70,
    label: "Good",
    color: "blue",
    badgeCls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dotCls: "bg-blue-500",
  },
  {
    minScore: 50,
    label: "Fair",
    color: "amber",
    badgeCls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    dotCls: "bg-amber-400",
  },
  {
    minScore: 25,
    label: "Low",
    color: "orange",
    badgeCls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    dotCls: "bg-orange-500",
  },
  {
    minScore: 0,
    label: "At Risk",
    color: "red",
    badgeCls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dotCls: "bg-red-500",
  },
];

export function getTrustTier(score: number): TrustTier {
  for (const tier of TRUST_TIERS) {
    if (score >= tier.minScore) return tier;
  }
  return TRUST_TIERS[TRUST_TIERS.length - 1];
}

// ─── Pure score calculation ───────────────────────────────────────────────────

export interface TrustScoreInput {
  onTimePayments: number;
  latePayments: number;
  missedPayments: number;
}

/**
 * Calculate trust score from raw payment counts and trust score settings.
 * Pure function — no side effects, safe to call anywhere.
 * Weights should be passed from getTrustScoreSettings() and used throughout.
 */
export function calculateTrustScore(
  input: TrustScoreInput,
  weights?: { onTimePaymentWeight: number; latePaymentWeight: number; missedPaymentWeight: number }
): number {
  const { onTimePayments, latePayments, missedPayments } = input;
  // Use provided weights from settings, or fallback to defaults if not available
  const w = weights || {
    onTimePaymentWeight: TRUST_WEIGHTS.ON_TIME,
    latePaymentWeight: TRUST_WEIGHTS.LATE,
    missedPaymentWeight: TRUST_WEIGHTS.MISSED,
  };
  const raw =
    100 +
    onTimePayments * w.onTimePaymentWeight +
    latePayments * w.latePaymentWeight +
    missedPayments * w.missedPaymentWeight;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ─── Firestore update helpers ─────────────────────────────────────────────────

/**
 * Record an on-time payment and recalculate the score.
 * Call from inside makeContribution() when status transitions pending → paid.
 */
export async function recordOnTimePayment(
  tx: admin.firestore.Transaction,
  circleId: string,
  currentBreakdown: {
    onTimePayments: number;
    latePayments: number;
    missedPayments: number;
  }
): Promise<void> {
  const settings = await getTrustScoreSettings();
  const newBreakdown = {
    onTimePayments: currentBreakdown.onTimePayments + 1,
    latePayments: currentBreakdown.latePayments,
    missedPayments: currentBreakdown.missedPayments,
  };
  const newScore = calculateTrustScore(newBreakdown, {
    onTimePaymentWeight: settings.onTimePaymentWeight,
    latePaymentWeight: settings.latePaymentWeight,
    missedPaymentWeight: settings.missedPaymentWeight,
  });

  tx.update(adminDb.collection("circles").doc(circleId), {
    trustScore: newScore,
    "trustScoreBreakdown.onTimePayments": FieldValue.increment(1),
    "trustScoreBreakdown.lastUpdated": FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Record a late payment and recalculate the score.
 * Call from applyPenaltyToContribution() when pending → late.
 */
export async function recordLatePayment(
  tx: admin.firestore.Transaction,
  circleId: string,
  currentBreakdown: {
    onTimePayments: number;
    latePayments: number;
    missedPayments: number;
  }
): Promise<void> {
  const settings = await getTrustScoreSettings();
  const newBreakdown = {
    onTimePayments: currentBreakdown.onTimePayments,
    latePayments: currentBreakdown.latePayments + 1,
    missedPayments: currentBreakdown.missedPayments,
  };
  const newScore = calculateTrustScore(newBreakdown, {
    onTimePaymentWeight: settings.onTimePaymentWeight,
    latePaymentWeight: settings.latePaymentWeight,
    missedPaymentWeight: settings.missedPaymentWeight,
  });

  tx.update(adminDb.collection("circles").doc(circleId), {
    trustScore: newScore,
    "trustScoreBreakdown.latePayments": FieldValue.increment(1),
    "trustScoreBreakdown.lastUpdated": FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Record a missed payment and recalculate the score.
 * Call when a late contribution is escalated to missed (auto-removal path).
 */
export async function recordMissedPayment(
  tx: admin.firestore.Transaction,
  circleId: string,
  currentBreakdown: {
    onTimePayments: number;
    latePayments: number;
    missedPayments: number;
  }
): Promise<void> {
  const settings = await getTrustScoreSettings();
  const newBreakdown = {
    onTimePayments: currentBreakdown.onTimePayments,
    latePayments: currentBreakdown.latePayments,
    missedPayments: currentBreakdown.missedPayments + 1,
  };
  const newScore = calculateTrustScore(newBreakdown, {
    onTimePaymentWeight: settings.onTimePaymentWeight,
    latePaymentWeight: settings.latePaymentWeight,
    missedPaymentWeight: settings.missedPaymentWeight,
  });

  tx.update(adminDb.collection("circles").doc(circleId), {
    trustScore: newScore,
    "trustScoreBreakdown.missedPayments": FieldValue.increment(1),
    "trustScoreBreakdown.lastUpdated": FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

  tx.update(adminDb.collection("circles").doc(circleId), {
    trustScore: newScore,
    "trustScoreBreakdown.missedPayments": FieldValue.increment(1),
    "trustScoreBreakdown.lastUpdated": FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ─── Full recompute (cron / admin action) ─────────────────────────────────────

export interface RecalculationResult {
  circleId: string;
  previousScore: number;
  newScore: number;
  breakdown: TrustScoreInput & { lastUpdated: Timestamp };
}

/**
 * Recompute a single circle's trust score by counting all its contribution
 * documents. This is the authoritative source of truth and should be run
 * periodically via cron to correct any drift caused by incremental updates.
 *
 * Does NOT run inside a transaction because it reads a potentially large
 * sub-collection — instead it uses a Firestore batch update at the end.
 */
export async function recomputeCircleTrustScore(
  circleId: string
): Promise<RecalculationResult> {
  const circleRef = adminDb.collection("circles").doc(circleId);
  const circleSnap = await circleRef.get();

  if (!circleSnap.exists) {
    throw new Error(`Circle ${circleId} not found`);
  }

  const previousScore = (circleSnap.data()?.trustScore as number) ?? 100;

  // Count contribution statuses across all cycles for this circle
  const [paidSnap, lateSnap, missedSnap] = await Promise.all([
    adminDb
      .collection("contributions")
      .where("circleId", "==", circleId)
      .where("status", "==", "paid")
      .get(),
    adminDb
      .collection("contributions")
      .where("circleId", "==", circleId)
      .where("status", "==", "late")
      .get(),
    adminDb
      .collection("contributions")
      .where("circleId", "==", circleId)
      .where("status", "==", "missed")
      .get(),
  ]);

  // On-time = paid contributions that were NOT late (no penaltyAmount set)
  const onTimePayments = paidSnap.docs.filter(
    (d) => !d.data().penaltyAmount
  ).length;
  const latePaymentsPaid = paidSnap.docs.filter(
    (d) => !!d.data().penaltyAmount
  ).length;
  const latePaymentsPending = lateSnap.size;
  const missedPayments = missedSnap.size;

  // "latePayments" in the breakdown counts both paid-late and still-late
  const latePayments = latePaymentsPaid + latePaymentsPending;

  const breakdown: TrustScoreInput = {
    onTimePayments,
    latePayments,
    missedPayments,
  };

  const newScore = calculateTrustScore(breakdown);
  const lastUpdated = Timestamp.now();

  await circleRef.update({
    trustScore: newScore,
    trustScoreBreakdown: {
      onTimePayments,
      latePayments,
      missedPayments,
      lastUpdated,
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    circleId,
    previousScore,
    newScore,
    breakdown: { ...breakdown, lastUpdated },
  };
}

/**
 * Recompute trust scores for ALL active circles.
 * Called by the nightly cron job.
 */
export async function recomputeAllTrustScores(): Promise<RecalculationResult[]> {
  const snap = await adminDb
    .collection("circles")
    .where("status", "in", ["active", "paused"])
    .get();

  const results: RecalculationResult[] = [];

  // Process in serial to avoid hammering Firestore with parallel reads
  for (const doc of snap.docs) {
    try {
      const result = await recomputeCircleTrustScore(doc.id);
      results.push(result);
    } catch (err) {
      console.error(`[trust-score-service] Failed to recompute ${doc.id}:`, err);
    }
  }

  return results;
}