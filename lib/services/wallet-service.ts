/**
 * Wallet Service
 * Handles balance reads, credits, debits, and pending amount management.
 * All mutation helpers accept an active Firestore Transaction so callers
 * can compose multi-step operations atomically.
 */

import { adminDb, admin } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Wallet } from "@/lib/types/wallet";
import type { Transaction as AppTransaction } from "@/lib/types/transaction";

// ─── Custom error ─────────────────────────────────────────────────────────────

export class WalletError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "INSUFFICIENT_FUNDS"
      | "INVALID_AMOUNT"
      | "BELOW_MINIMUM",
    message: string
  ) {
    super(message);
    this.name = "WalletError";
  }
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

/**
 * Fetch the wallet document for a user.
 * Safe to call outside a transaction for simple balance reads.
 */
export async function getWallet(userId: string): Promise<Wallet> {
  const snap = await adminDb.collection("wallets").doc(userId).get();
  if (!snap.exists) {
    throw new WalletError("NOT_FOUND", `Wallet not found for user ${userId}`);
  }
  return snap.data() as Wallet;
}

/**
 * Return only the available balance in kobo.
 * Returns 0 instead of throwing if the wallet doesn't exist yet.
 */
export async function getAvailableBalance(userId: string): Promise<number> {
  try {
    const wallet = await getWallet(userId);
    return wallet.available;
  } catch {
    return 0;
  }
}

// ─── Transactional mutation helpers ──────────────────────────────────────────
// These must be called from inside adminDb.runTransaction().

/**
 * Credit a user's wallet within an existing Firestore transaction.
 * Also creates the corresponding transaction document.
 *
 * @returns The ID of the new transaction document.
 */
export async function creditWallet(
  firestoreTx: admin.firestore.Transaction,
  userId: string,
  amountKobo: number,
  type: AppTransaction["type"],
  description: string,
  meta?: {
    circleId?: string;
    reference?: string;
    providerReference?: string;
    fee?: number;
  }
): Promise<string> {
  assertPositive(amountKobo);

  const walletRef = adminDb.collection("wallets").doc(userId);
  const walletSnap = await firestoreTx.get(walletRef);

  if (!walletSnap.exists) {
    throw new WalletError("NOT_FOUND", `Wallet not found for user ${userId}`);
  }

  const wallet = walletSnap.data() as Wallet;
  const fee = meta?.fee ?? 0;

  // Update wallet fields
  const update: Record<string, unknown> = {
    available: FieldValue.increment(amountKobo),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (type === "contribution") {
    update.totalSaved = FieldValue.increment(amountKobo);
  }
  if (type === "payout") {
    update.totalReceived = FieldValue.increment(amountKobo);
  }
  if (type === "referral_bonus") {
    update.referralEarnings = FieldValue.increment(amountKobo);
  }

  firestoreTx.update(walletRef, update);

  // Create transaction record
  const txRef = adminDb.collection("transactions").doc();
  const txDoc: Omit<AppTransaction, "id"> = {
    userId,
    circleId: meta?.circleId,
    type,
    direction: "credit",
    amount: amountKobo,
    fee,
    netAmount: amountKobo - fee,
    status: "success",
    reference: meta?.reference ?? txRef.id,
    providerReference: meta?.providerReference,
    description,
    createdAt: FieldValue.serverTimestamp() as any,
    updatedAt: FieldValue.serverTimestamp() as any,
  };
  firestoreTx.set(txRef, txDoc);

  return txRef.id;
}

/**
 * Debit a user's wallet within an existing Firestore transaction.
 * Throws WalletError if the available balance is insufficient.
 *
 * @returns The ID of the new transaction document.
 */
export async function debitWallet(
  firestoreTx: admin.firestore.Transaction,
  userId: string,
  amountKobo: number,
  type: AppTransaction["type"],
  description: string,
  meta?: {
    circleId?: string;
    reference?: string;
    fee?: number;
  }
): Promise<string> {
  assertPositive(amountKobo);

  const walletRef = adminDb.collection("wallets").doc(userId);
  const walletSnap = await firestoreTx.get(walletRef);

  if (!walletSnap.exists) {
    throw new WalletError("NOT_FOUND", `Wallet not found for user ${userId}`);
  }

  const wallet = walletSnap.data() as Wallet;
  const fee = meta?.fee ?? 0;

  if (wallet.available < amountKobo) {
    throw new WalletError(
      "INSUFFICIENT_FUNDS",
      `Insufficient funds. Available: ₦${wallet.available / 100}, Required: ₦${amountKobo / 100}`
    );
  }

  firestoreTx.update(walletRef, {
    available: FieldValue.increment(-amountKobo),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const txRef = adminDb.collection("transactions").doc();
  const txDoc: Omit<AppTransaction, "id"> = {
    userId,
    circleId: meta?.circleId,
    type,
    direction: "debit",
    amount: amountKobo,
    fee,
    netAmount: amountKobo - fee,
    status: "success",
    reference: meta?.reference ?? txRef.id,
    description,
    createdAt: FieldValue.serverTimestamp() as any,
    updatedAt: FieldValue.serverTimestamp() as any,
  };
  firestoreTx.set(txRef, txDoc);

  return txRef.id;
}

/**
 * Move an amount from pending to available within a transaction.
 * Used when a pending deposit is confirmed via webhook.
 */
export async function confirmPending(
  firestoreTx: admin.firestore.Transaction,
  userId: string,
  amountKobo: number
): Promise<void> {
  assertPositive(amountKobo);

  const walletRef = adminDb.collection("wallets").doc(userId);
  const walletSnap = await firestoreTx.get(walletRef);

  if (!walletSnap.exists) {
    throw new WalletError("NOT_FOUND", `Wallet not found for user ${userId}`);
  }

  firestoreTx.update(walletRef, {
    pending: FieldValue.increment(-amountKobo),
    available: FieldValue.increment(amountKobo),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Add to the pending balance (e.g. when a deposit is initiated but not yet confirmed).
 */
export async function addPending(
  firestoreTx: admin.firestore.Transaction,
  userId: string,
  amountKobo: number
): Promise<void> {
  assertPositive(amountKobo);

  const walletRef = adminDb.collection("wallets").doc(userId);
  firestoreTx.update(walletRef, {
    pending: FieldValue.increment(amountKobo),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ─── Fee calculation ──────────────────────────────────────────────────────────

/**
 * Calculate the withdrawal fee: 1% + ₦50 flat, capped at ₦500.
 * Input and output are both in kobo.
 */
export function calculateWithdrawalFee(amountKobo: number): number {
  const percent = Math.round(amountKobo * 0.01);
  const flat = 5_000; // ₦50
  const cap = 50_000; // ₦500
  return Math.min(percent + flat, cap);
}

// ─── Guard ────────────────────────────────────────────────────────────────────

function assertPositive(amountKobo: number): void {
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
    throw new WalletError("INVALID_AMOUNT", `Amount must be a positive number, got ${amountKobo}`);
  }
}