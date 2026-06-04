import type { Timestamp as ClientTimestamp } from "firebase/firestore";
import type { Timestamp as AdminTimestamp } from "firebase-admin/firestore";

export type FirestoreTimestamp = ClientTimestamp | AdminTimestamp;

// ──────────────────────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────────────────────

export type TriggerType =
  | "circle_completed"
  | "circle_moderated"
  | "first_contribution"
  | "contribution_streak"
  | "wallet_funded_threshold"
  | "wallet_total_saved_threshold"
  | "referral_milestone"
  | "circle_filled"
  | "first_circle_joined"
  | "onboarding_complete"
  | "investment_made";

export type EventStatus = "draft" | "active" | "ended" | "paused";
export type RewardType = "wallet_credit" | "badge" | "both";
export type ClaimStatus = "pending" | "awarded" | "failed";
export type BadgeRarity = "common" | "rare" | "legendary";

// ──────────────────────────────────────────────────────────────────────────────
// Badge
// ──────────────────────────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  description: string;
  iconName?: string; // Lucide icon name, e.g. "Trophy"
  iconEmoji?: string; // fallback for legacy badges
  iconUrl?: string;
  rarity: BadgeRarity;
  createdAt: FirestoreTimestamp;
}

// ──────────────────────────────────────────────────────────────────────────────
// Event
// ──────────────────────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  title: string;
  description: string;
  status: EventStatus;
  triggerType: TriggerType;
  conditions: Record<string, any>; // flexible object for trigger-specific conditions
  rewardType: RewardType;
  rewardAmountKobo?: number; // only if rewardType includes wallet_credit
  badgeId?: string;
  maxClaimsTotal: number; // 0 = unlimited
  maxClaimsPerUser: number; // typically 1
  startDate: FirestoreTimestamp;
  endDate: FirestoreTimestamp;
  createdBy: string; // admin userId
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// ──────────────────────────────────────────────────────────────────────────────
// Event Claim
// ──────────────────────────────────────────────────────────────────────────────

export interface EventClaim {
  id: string;
  eventId: string;
  userId: string;
  triggerType: TriggerType;
  triggerData: Record<string, any>; // snapshot of what triggered it (e.g. circleId, cycle count)
  rewardType: RewardType;
  rewardAmountKobo?: number;
  badgeId?: string;
  status: ClaimStatus;
  awardedAt?: FirestoreTimestamp;
  transactionId?: string; // linked wallet transaction if applicable
  createdAt: FirestoreTimestamp;
}

// ──────────────────────────────────────────────────────────────────────────────
// User Badge (subcollection)
// ──────────────────────────────────────────────────────────────────────────────

export interface UserBadge {
  badgeId: string;
  eventId: string;
  earnedAt: FirestoreTimestamp;
  triggerType: TriggerType;
}

// ──────────────────────────────────────────────────────────────────────────────
// Trigger Data Shapes
// ──────────────────────────────────────────────────────────────────────────────

export interface CircleCompletedTriggerData {
  circleId: string;
  circleName: string;
  memberCount: number;
  totalCycles: number;
}

export interface ContributionStreakTriggerData {
  circleId: string;
  consecutiveOnTimePayments: number;
}

export interface WalletFundedThresholdTriggerData {
  amountDepositedKobo: number;
}

export interface ReferralMilestoneTriggerData {
  totalReferralsCount: number;
}
