import { evaluateAndAward } from "@/lib/services/event-service";

/**
 * Trigger dispatcher: thin fire-and-forget wrappers
 * Called from circle-service, payment-service, investment-service, etc.
 * These should NOT block the primary action if event evaluation fails.
 */

export function triggerCircleCompleted(
  userId: string,
  circleId: string,
  circleName: string,
  memberCount: number,
  totalCycles: number,
): void {
  // Fire and forget
  evaluateAndAward(userId, "circle_completed", {
    circleId,
    circleName,
    memberCount,
    totalCycles,
  }).catch((err) => {
    console.error(
      `Failed to trigger circle_completed for user ${userId}:`,
      err,
    );
  });
}

export function triggerCircleModerated(
  userId: string,
  circleId: string,
  circleName: string,
  memberCount: number,
  totalCycles: number,
): void {
  // Fire and forget
  evaluateAndAward(userId, "circle_moderated", {
    circleId,
    circleName,
    memberCount,
    totalCycles,
  }).catch((err) => {
    console.error(
      `Failed to trigger circle_moderated for user ${userId}:`,
      err,
    );
  });
}

export function triggerFirstContribution(userId: string): void {
  // Fire and forget
  evaluateAndAward(userId, "first_contribution", {}).catch((err) => {
    console.error(
      `Failed to trigger first_contribution for user ${userId}:`,
      err,
    );
  });
}

export function triggerContributionStreak(
  userId: string,
  circleId: string,
  consecutiveOnTimePayments: number,
): void {
  // Fire and forget
  evaluateAndAward(userId, "contribution_streak", {
    circleId,
    consecutiveOnTimePayments,
  }).catch((err) => {
    console.error(
      `Failed to trigger contribution_streak for user ${userId}:`,
      err,
    );
  });
}

export function triggerWalletFundedThreshold(
  userId: string,
  amountDepositedKobo: number,
): void {
  // Fire and forget
  evaluateAndAward(userId, "wallet_funded_threshold", {
    amountDepositedKobo,
  }).catch((err) => {
    console.error(
      `Failed to trigger wallet_funded_threshold for user ${userId}:`,
      err,
    );
  });
}

export function triggerWalletTotalSavedThreshold(
  userId: string,
  totalSavedKobo: number,
): void {
  // Fire and forget
  evaluateAndAward(userId, "wallet_total_saved_threshold", {
    totalSavedKobo,
  }).catch((err) => {
    console.error(
      `Failed to trigger wallet_total_saved_threshold for user ${userId}:`,
      err,
    );
  });
}

export function triggerReferralMilestone(
  userId: string,
  totalReferralsCount: number,
): void {
  // Fire and forget
  evaluateAndAward(userId, "referral_milestone", {
    totalReferralsCount,
  }).catch((err) => {
    console.error(
      `Failed to trigger referral_milestone for user ${userId}:`,
      err,
    );
  });
}

export function triggerCircleFilled(
  userId: string,
  circleId: string,
  circleName: string,
  maxMembers: number,
): void {
  // Fire and forget
  evaluateAndAward(userId, "circle_filled", {
    circleId,
    circleName,
    memberCount: maxMembers,
  }).catch((err) => {
    console.error(`Failed to trigger circle_filled for user ${userId}:`, err);
  });
}

export function triggerFirstCircleJoined(
  userId: string,
  circleId: string,
  circleName: string,
): void {
  // Fire and forget
  evaluateAndAward(userId, "first_circle_joined", {
    circleId,
    circleName,
  }).catch((err) => {
    console.error(
      `Failed to trigger first_circle_joined for user ${userId}:`,
      err,
    );
  });
}

export function triggerOnboardingComplete(userId: string): void {
  // Fire and forget
  evaluateAndAward(userId, "onboarding_complete", {}).catch((err) => {
    console.error(
      `Failed to trigger onboarding_complete for user ${userId}:`,
      err,
    );
  });
}

export function triggerInvestmentMade(
  userId: string,
  investmentId: string,
  packageName: string,
  amountKobo: number,
): void {
  // Fire and forget
  evaluateAndAward(userId, "investment_made", {
    investmentId,
    packageName,
    amountKobo,
  }).catch((err) => {
    console.error(
      `Failed to trigger investment_made for user ${userId}:`,
      err,
    );
  });
}
