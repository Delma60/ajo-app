import crypto from "crypto";
import { adminDb, admin } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { creditWallet } from "@/lib/services/wallet-service";
import type { User, BankAccount } from "@/lib/types/user";
import type { Transaction } from "@/lib/types/transaction";

export interface DeviceMetadata {
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface ReferralBonusPending {
  id: string;
  referrerId: string;
  refereeId: string;
  bonusKobo: number;
  depositTxRef: string;
  fundingSourceHash?: string | null;
  releaseCondition: "first_three_contributions" | string;
  status: "pending" | "awarded" | "cancelled";
  createdAt: any;
  updatedAt: any;
  awardedAt?: any;
}

const DEVICE_ACCOUNT_LIMIT = 5;
const IP_ACCOUNT_LIMIT = 10;
const REFERRAL_RELEASE_CONTRIBUTIONS = 3;
const DEFAULT_USER_TRUST_SCORE = 20;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeString(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function extractFundingSourceHash(flwData: Record<string, unknown>): string | null {
  if (!flwData || typeof flwData !== "object") return null;

  const customer = flwData.customer as Record<string, unknown> | undefined;
  const pieces: string[] = [];

  if (customer) {
    if (typeof customer.email === "string") pieces.push(customer.email);
    if (typeof customer.phone_number === "string") pieces.push(customer.phone_number);
    if (typeof customer.name === "string") pieces.push(customer.name);
    if (typeof customer.id === "string") pieces.push(customer.id);
  }

  if (typeof flwData.ip === "string") pieces.push(flwData.ip);
  if (typeof flwData.tx_ref === "string") pieces.push(flwData.tx_ref);

  const source = pieces
    .map((value) => normalizeString(value))
    .filter(Boolean)
    .join("|");

  return source ? sha256(source) : null;
}

export function isKycVerified(user: User | null | undefined): boolean {
  return user?.kycStatus === "verified" && !!user?.kycIdentity?.fullName;
}

export function normalizeVerifiedName(fullName: string): string {
  return normalizeString(fullName);
}

export async function recordLoginMetadata(
  userId: string,
  metadata: DeviceMetadata,
): Promise<void> {
  await adminDb.runTransaction(async (tx) => {
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return;

    const now = FieldValue.serverTimestamp();
    const updates: Record<string, unknown> = {
      "security.lastSeenAt": now,
      updatedAt: now,
    };

    const suspiciousUpdates: Array<Promise<void>> = [];
    const userIdsToMark: Set<string> = new Set([userId]);

    if (metadata.deviceId) {
      const deviceHash = sha256(normalizeString(metadata.deviceId));
      const deviceRef = adminDb.collection("device_fingerprints").doc(deviceHash);
      const deviceSnap = await tx.get(deviceRef);
      const previousUserIds = (deviceSnap.exists ? (deviceSnap.data()?.userIds as string[]) ?? [] : []);
      const updatedUserIds = Array.from(new Set([...previousUserIds, userId]));

      tx.set(
        deviceRef,
        {
          deviceIdHash: deviceHash,
          userIds: updatedUserIds,
          createdAt: deviceSnap.exists ? deviceSnap.data()?.createdAt ?? now : now,
          updatedAt: now,
        },
        { merge: true }
      );

      updates["security.deviceIds"] = FieldValue.arrayUnion(deviceHash);
      if (updatedUserIds.length >= DEVICE_ACCOUNT_LIMIT) {
        updatedUserIds.forEach((id) => userIdsToMark.add(id));
        suspiciousUpdates.push(Promise.resolve());
      }
    }

    if (metadata.ipAddress) {
      const ipHash = sha256(normalizeString(metadata.ipAddress));
      const ipRef = adminDb.collection("ip_fingerprints").doc(ipHash);
      const ipSnap = await tx.get(ipRef);
      const previousUserIds = (ipSnap.exists ? (ipSnap.data()?.userIds as string[]) ?? [] : []);
      const updatedUserIds = Array.from(new Set([...previousUserIds, userId]));

      tx.set(
        ipRef,
        {
          ipHash,
          userIds: updatedUserIds,
          createdAt: ipSnap.exists ? ipSnap.data()?.createdAt ?? now : now,
          updatedAt: now,
        },
        { merge: true }
      );

      updates["security.ipAddresses"] = FieldValue.arrayUnion(ipHash);
      if (updatedUserIds.length >= IP_ACCOUNT_LIMIT) {
        updatedUserIds.forEach((id) => userIdsToMark.add(id));
        suspiciousUpdates.push(Promise.resolve());
      }
    }

    tx.set(userRef, updates, { merge: true });

    if (userIdsToMark.size > 1) {
      for (const id of userIdsToMark) {
        const flaggedUserRef = adminDb.collection("users").doc(id);
        tx.update(flaggedUserRef, {
          "security.flaggedForRewards": true,
          "security.lastSeenAt": now,
          updatedAt: now,
        });
      }
    }
  });
}

export async function recordFundingSourceHash(
  tx: admin.firestore.Transaction,
  userId: string,
  fundingSourceHash: string,
): Promise<void> {
  if (!fundingSourceHash) return;

  const sourceRef = adminDb.collection("funding_sources").doc(fundingSourceHash);
  const sourceSnap = await tx.get(sourceRef);
  const now = FieldValue.serverTimestamp();
  const previousUserIds = (sourceSnap.exists ? (sourceSnap.data()?.userIds as string[]) ?? [] : []);
  const updatedUserIds = Array.from(new Set([...previousUserIds, userId]));

  tx.set(
    sourceRef,
    {
      userIds: updatedUserIds,
      createdAt: sourceSnap.exists ? sourceSnap.data()?.createdAt ?? now : now,
      updatedAt: now,
    },
    { merge: true }
  );

  tx.update(adminDb.collection("users").doc(userId), {
    "security.fundingSourceHashes": FieldValue.arrayUnion(fundingSourceHash),
    updatedAt: now,
  });

  if (updatedUserIds.length > 1) {
    for (const otherUserId of updatedUserIds) {
      tx.update(adminDb.collection("users").doc(otherUserId), {
        "security.flaggedForRewards": true,
        "security.sharedFundingSourceCount": updatedUserIds.length,
        updatedAt: now,
      });
    }
  }
}

export function isBankAccountNameMatchingKyc(
  user: User,
  bankAccount: BankAccount,
): boolean {
  if (!isKycVerified(user) || !bankAccount.accountName) return true;
  const knownName = normalizeVerifiedName(user.kycIdentity?.fullName ?? "");
  return normalizeVerifiedName(bankAccount.accountName) === knownName;
}

export async function isUniqueKycIdentity(
  userId: string,
  identity: { bvn?: string; nin?: string; fullName?: string },
): Promise<boolean> {
  const queries: Promise<admin.firestore.QuerySnapshot>[] = [];
  if (identity.bvn) {
    queries.push(adminDb.collection("users").where("kycIdentity.bvn", "==", identity.bvn).get());
  }
  if (identity.nin) {
    queries.push(adminDb.collection("users").where("kycIdentity.nin", "==", identity.nin).get());
  }

  if (queries.length === 0) return true;

  const results = await Promise.all(queries);
  for (const snapshot of results) {
    for (const doc of snapshot.docs) {
      if (doc.id !== userId) return false;
    }
  }

  return true;
}

export async function createPendingReferralBonus(
  tx: admin.firestore.Transaction,
  referrerId: string,
  refereeId: string,
  bonusKobo: number,
  depositTxRef: string,
  fundingSourceHash?: string | null,
): Promise<string> {
  const pendingRef = adminDb.collection("referral_bonus_pending").doc();
  tx.set(pendingRef, {
    id: pendingRef.id,
    referrerId,
    refereeId,
    bonusKobo,
    depositTxRef,
    fundingSourceHash: fundingSourceHash ?? null,
    status: "pending",
    releaseCondition: "first_three_contributions",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return pendingRef.id;
}

export async function releasePendingReferralBonuses(refereeId: string): Promise<void> {
  const pendingSnap = await adminDb
    .collection("referral_bonus_pending")
    .where("refereeId", "==", refereeId)
    .where("status", "==", "pending")
    .get();

  if (pendingSnap.empty) return;

  const contributionsSnap = await adminDb
    .collection("contributions")
    .where("userId", "==", refereeId)
    .where("status", "==", "paid")
    .get();

  if (contributionsSnap.size < REFERRAL_RELEASE_CONTRIBUTIONS) return;

  await adminDb.runTransaction(async (tx) => {
    const refereeUserSnap = await tx.get(adminDb.collection("users").doc(refereeId));
    if (!refereeUserSnap.exists) return;
    const refereeUser = refereeUserSnap.data() as User;
    const now = FieldValue.serverTimestamp();

    for (const pendingDoc of pendingSnap.docs) {
      const pending = pendingDoc.data() as ReferralBonusPending;
      if (pending.status !== "pending") continue;

      const referrerSnap = await tx.get(adminDb.collection("users").doc(pending.referrerId));
      if (!referrerSnap.exists) continue;
      const referrerUser = referrerSnap.data() as User;

      if (!isKycVerified(referrerUser) || !isKycVerified(refereeUser)) {
        continue;
      }
      if (referrerUser.security?.flaggedForRewards || refereeUser.security?.flaggedForRewards) {
        continue;
      }

      await creditWallet(
        tx,
        pending.referrerId,
        pending.bonusKobo,
        "referral_bonus",
        `Referral bonus for ${refereeUser.name}`,
        { reference: pendingDoc.id }
      );

      tx.update(pendingDoc.ref, {
        status: "awarded",
        awardedAt: now,
        updatedAt: now,
      });
    }
  });
}

export interface UserTrustScoreInput {
  onTimeContributions: number;
  lateContributions: number;
  missedContributions: number;
}

export function calculateUserTrustScore(
  input: UserTrustScoreInput,
  base = DEFAULT_USER_TRUST_SCORE,
): number {
  const score =
    base +
    input.onTimeContributions * 5 +
    input.lateContributions * -10 +
    input.missedContributions * -20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function recordUserOnTimeContribution(
  tx: admin.firestore.Transaction,
  userId: string,
  currentBreakdown: UserTrustScoreInput,
): Promise<void> {
  const newBreakdown = {
    onTimeContributions: currentBreakdown.onTimeContributions + 1,
    lateContributions: currentBreakdown.lateContributions,
    missedContributions: currentBreakdown.missedContributions,
  };
  const newScore = calculateUserTrustScore(newBreakdown);

  tx.update(adminDb.collection("users").doc(userId), {
    trustScore: newScore,
    "trustScoreBreakdown.onTimeContributions": FieldValue.increment(1),
    "trustScoreBreakdown.lastUpdated": FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markUserKycVerified(
  userId: string,
  identity: { fullName: string; bvn?: string; nin?: string },
  verifiedBy: string,
): Promise<void> {
  const normalizedFullName = normalizeString(identity.fullName);
  await adminDb.collection("users").doc(userId).update({
    kycStatus: "verified",
    kycIdentity: {
      fullName: normalizedFullName,
      bvn: identity.bvn ?? null,
      nin: identity.nin ?? null,
      verifiedAt: FieldValue.serverTimestamp(),
      verifiedBy,
    },
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markUserKycRejected(userId: string): Promise<void> {
  await adminDb.collection("users").doc(userId).update({
    kycStatus: "rejected",
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function flagUserForRewards(userId: string): Promise<void> {
  await adminDb.collection("users").doc(userId).update({
    "security.flaggedForRewards": true,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function clearUserRewardFlag(userId: string): Promise<void> {
  await adminDb.collection("users").doc(userId).update({
    "security.flaggedForRewards": false,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
