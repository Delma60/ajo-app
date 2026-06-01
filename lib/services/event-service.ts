import {
  db,
  adminDb,
  Timestamp,
  query,
  collection,
  where,
  getDocs,
  getDoc,
  doc,
  runTransaction,
  setDoc,
} from "@/lib/firebase/admin";
import {
  Event,
  EventClaim,
  TriggerType,
  UserBadge,
  Badge,
} from "@/lib/types/event";
import { creditWallet } from "@/lib/services/wallet-service";
import { notificationService } from "@/lib/services/notification-service";

/**
 * Main entry point: evaluate all active events for a trigger and issue rewards
 */
export async function evaluateAndAward(
  userId: string,
  triggerType: TriggerType,
  triggerData: Record<string, any>,
): Promise<void> {
  try {
    // Query all active events matching this trigger type and within date range
    const now = Timestamp.now();
    const eventsRef = collection(adminDb, "events");
    const q = query(
      eventsRef,
      where("triggerType", "==", triggerType),
      where("status", "==", "active"),
      where("startDate", "<=", now),
      where("endDate", ">=", now),
    );

    const snapshot = await getDocs(q);
    const events = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Event[];

    // For each matching event, check eligibility and issue reward if eligible
    for (const event of events) {
      try {
        const isEligible = await checkEligibility(userId, event, triggerData);
        if (isEligible) {
          await issueReward(userId, event, triggerData);
        }
      } catch (error) {
        console.error(
          `Failed to evaluate event ${event.id} for user ${userId}:`,
          error,
        );
        // Fire-and-forget — don't let event errors disrupt the primary action
      }
    }
  } catch (error) {
    console.error(
      `Error in evaluateAndAward for user ${userId}, trigger ${triggerType}:`,
      error,
    );
  }
}

/**
 * Check if a user is eligible for an event based on:
 * 1. Not already claimed (respects maxClaimsPerUser)
 * 2. Event hasn't reached maxClaimsTotal
 * 3. Trigger conditions are satisfied
 */
export async function checkEligibility(
  userId: string,
  event: Event,
  triggerData: Record<string, any>,
): Promise<boolean> {
  try {
    // 1. Check if user already has a claim for this event
    const claimsRef = collection(adminDb, "event_claims");
    const userClaimsQ = query(
      claimsRef,
      where("eventId", "==", event.id),
      where("userId", "==", userId),
    );
    const userClaimsSnap = await getDocs(userClaimsQ);

    if (userClaimsSnap.size >= event.maxClaimsPerUser) {
      return false;
    }

    // 2. Check if event has reached total claims limit (0 = unlimited)
    if (event.maxClaimsTotal > 0) {
      const totalClaimsQ = query(
        claimsRef,
        where("eventId", "==", event.id),
        where("status", "==", "awarded"),
      );
      const totalClaimsSnap = await getDocs(totalClaimsQ);
      if (totalClaimsSnap.size >= event.maxClaimsTotal) {
        return false;
      }
    }

    // 3. Evaluate conditions against triggerData
    return evaluateConditions(event.conditions, triggerData);
  } catch (error) {
    console.error(`Error checking eligibility for event ${event.id}:`, error);
    return false;
  }
}

/**
 * Generic condition evaluator. Extends as needed for each trigger type.
 */
function evaluateConditions(
  conditions: Record<string, any>,
  triggerData: Record<string, any>,
): boolean {
  // Example implementations for common conditions:

  if (conditions.minMemberCount !== undefined) {
    if (
      triggerData.memberCount === undefined ||
      triggerData.memberCount < conditions.minMemberCount
    ) {
      return false;
    }
  }

  if (conditions.minAmountKobo !== undefined) {
    if (
      triggerData.amountDepositedKobo === undefined ||
      triggerData.amountDepositedKobo < conditions.minAmountKobo
    ) {
      return false;
    }
  }

  if (conditions.minConsecutivePayments !== undefined) {
    if (
      triggerData.consecutiveOnTimePayments === undefined ||
      triggerData.consecutiveOnTimePayments <
        conditions.minConsecutivePayments
    ) {
      return false;
    }
  }

  if (conditions.minReferralCount !== undefined) {
    if (
      triggerData.totalReferralsCount === undefined ||
      triggerData.totalReferralsCount < conditions.minReferralCount
    ) {
      return false;
    }
  }

  // If no conditions, always eligible
  return true;
}

/**
 * Issue reward to user inside a Firestore transaction.
 * Re-checks eligibility, creates claim, credits wallet, updates badge subcollection.
 */
export async function issueReward(
  userId: string,
  event: Event,
  triggerData: Record<string, any>,
): Promise<void> {
  return runTransaction(adminDb, async (transaction) => {
    // Re-check eligibility inside transaction to prevent race conditions
    const isEligible = await checkEligibility(userId, event, triggerData);
    if (!isEligible) {
      throw new Error("User no longer eligible for event");
    }

    // Create claim document
    const claimsRef = collection(adminDb, "event_claims");
    const claimDocRef = doc(claimsRef);
    const claim: EventClaim = {
      id: claimDocRef.id,
      eventId: event.id,
      userId,
      triggerType: event.triggerType,
      triggerData,
      rewardType: event.rewardType,
      rewardAmountKobo: event.rewardAmountKobo,
      badgeId: event.badgeId,
      status: "pending",
      createdAt: Timestamp.now(),
    };

    transaction.set(claimDocRef, claim);

    // Issue wallet credit if applicable
    let transactionId: string | undefined;
    if (event.rewardType === "wallet_credit" || event.rewardType === "both") {
      if (event.rewardAmountKobo && event.rewardAmountKobo > 0) {
        transactionId = await creditWallet(
          userId,
          event.rewardAmountKobo,
          "event_reward",
          `Reward from: ${event.title}`,
        );
      }
    }

    // Award badge if applicable
    if (event.rewardType === "badge" || event.rewardType === "both") {
      if (event.badgeId) {
        const userBadgeRef = doc(
          adminDb,
          "users",
          userId,
          "earned_badges",
          event.badgeId,
        );
        const userBadge: UserBadge = {
          badgeId: event.badgeId,
          eventId: event.id,
          earnedAt: Timestamp.now(),
          triggerType: event.triggerType,
        };
        transaction.set(userBadgeRef, userBadge);
      }
    }

    // Update claim status and transaction ID
    transaction.update(claimDocRef, {
      status: "awarded",
      awardedAt: Timestamp.now(),
      transactionId: transactionId || null,
    });

    // Send notification
    await notificationService.sendNotification(userId, {
      type: "general",
      title: "🎉 Reward Earned!",
      body: `You earned a reward from: ${event.title}`,
      link: "/rewards",
    });
  });
}

/**
 * List all awards/claims for a specific user
 */
export async function listUserClaims(userId: string): Promise<EventClaim[]> {
  const claimsRef = collection(adminDb, "event_claims");
  const q = query(
    claimsRef,
    where("userId", "==", userId),
    where("status", "==", "awarded"),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as EventClaim[];
}

/**
 * Get all badges earned by a user
 */
export async function listUserBadges(
  userId: string,
): Promise<(UserBadge & Badge)[]> {
  const badgesRef = collection(adminDb, "users", userId, "earned_badges");
  const snapshot = await getDocs(badgesRef);

  const results: (UserBadge & Badge)[] = [];

  for (const badgeDoc of snapshot.docs) {
    const userBadge = badgeDoc.data() as UserBadge;

    // Fetch the badge definition
    if (userBadge.badgeId) {
      const badgeDef = await getDoc(
        doc(adminDb, "badges", userBadge.badgeId),
      );
      if (badgeDef.exists()) {
        results.push({
          ...userBadge,
          ...(badgeDef.data() as Badge),
        });
      }
    }
  }

  return results.sort(
    (a, b) => b.earnedAt.toMillis() - a.earnedAt.toMillis(),
  );
}

/**
 * Get claim details including the related event
 */
export async function getClaimWithEvent(
  claimId: string,
): Promise<(EventClaim & { event: Event }) | null> {
  const claimDoc = await getDoc(doc(adminDb, "event_claims", claimId));
  if (!claimDoc.exists()) {
    return null;
  }

  const claim = claimDoc.data() as EventClaim;
  const eventDoc = await getDoc(doc(adminDb, "events", claim.eventId));

  if (!eventDoc.exists()) {
    return null;
  }

  return {
    ...claim,
    event: eventDoc.data() as Event,
  };
}
