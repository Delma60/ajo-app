/**
 * Wallet Service
 * Handles balance reads, credits, debits, and pending amount management.
 *
 * ─── FIRESTORE TRANSACTION RULE ─────────────────────────────────────────────
 * Firestore transactions require ALL reads to complete before ANY write.
 * Therefore every helper that accepts a Transaction must NOT perform a
 * tx.get() after a tx.set() / tx.update() has already been called in the
 * same transaction.
 *
 * creditWalletBalance() is called from inside processSuccessfulDeposit()
 * AFTER tx.update(pendingRef, ...) — so it must NOT do its own tx.get().
 * Instead it receives the pre-read wallet snapshot from the caller.
 *
 * creditWallet() and debitWallet() are called as the FIRST operations in
 * their own transactions (or before any writes), so they can still do
 * tx.get() internally.
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

export async function getWallet(userId: string): Promise<Wallet> {
  const snap = await adminDb.collection("wallets").doc(userId).get();
  if (!snap.exists) {
    throw new WalletError("NOT_FOUND", `Wallet not found for user ${userId}`);
  }
  return snap.data() as Wallet;
}

export async function getAvailableBalance(userId: string): Promise<number> {
  try {
    const wallet = await getWallet(userId);
    return wallet.available;
  } catch {
    return 0;
  }
}

// ─── creditWallet ─────────────────────────────────────────────────────────────
// Safe to call as the FIRST operation in a transaction (does its own tx.get).
// Do NOT call this after any tx.set/tx.update in the same transaction.

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
  const walletSnap = await firestoreTx.get(walletRef); // READ — must be before any write

  if (!walletSnap.exists) {
    throw new WalletError("NOT_FOUND", `Wallet not found for user ${userId}`);
  }

  const fee = meta?.fee ?? 0;

  const update: Record<string, unknown> = {
    available: FieldValue.increment(amountKobo),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (type === "contribution") update.totalSaved = FieldValue.increment(amountKobo);
  if (type === "payout") update.totalReceived = FieldValue.increment(amountKobo);
  if (type === "referral_bonus") update.referralEarnings = FieldValue.increment(amountKobo);

  firestoreTx.update(walletRef, update); // WRITE

  const txRef = adminDb.collection("transactions").doc();
  const txDoc: Omit<AppTransaction, "id"> = {
    userId,
    circleId: meta?.circleId ?? null,
    type,
    direction: "credit",
    amount: amountKobo,
    fee,
    netAmount: amountKobo - fee,
    status: "success",
    reference: meta?.reference ?? txRef.id,
    providerReference: meta?.providerReference ?? null,
    description,
    createdAt: FieldValue.serverTimestamp() as any,
    updatedAt: FieldValue.serverTimestamp() as any,
  };
  firestoreTx.set(txRef, txDoc); // WRITE

  return txRef.id;
}

// ─── creditWalletBalance ──────────────────────────────────────────────────────
// Called inside processSuccessfulDeposit() AFTER tx.update(pendingRef) has
// already been issued. Therefore this function must NOT perform a tx.get() —
// the caller is responsible for pre-reading the wallet and passing the ref.
//
// The wallet doc existence is guaranteed at this point because:
//   1. It was created during user registration (signUpWithEmail / signInWithGoogle)
//   2. initializeDeposit() would have thrown INSUFFICIENT_FUNDS earlier if missing
//
// If for some reason the wallet is truly missing we throw — the transaction
// will roll back and the webhook will be retried by Flutterwave.

export async function creditWalletBalance(
  firestoreTx: admin.firestore.Transaction,
  userId: string,
  amountKobo: number,
  type: AppTransaction["type"]
): Promise<void> {
  assertPositive(amountKobo);

  const walletRef = adminDb.collection("wallets").doc(userId);
  // NO tx.get() here — this function is called after writes have been issued
  // in the same transaction. The wallet must already exist (created at signup).

  const update: Record<string, unknown> = {
    available: FieldValue.increment(amountKobo),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (type === "payout") update.totalReceived = FieldValue.increment(amountKobo);
  if (type === "referral_bonus") update.referralEarnings = FieldValue.increment(amountKobo);

  firestoreTx.update(walletRef, update); // WRITE only — no preceding read
}

// ─── debitWallet ──────────────────────────────────────────────────────────────
// Safe to call as the FIRST operation in a transaction (does its own tx.get).

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
  const walletSnap = await firestoreTx.get(walletRef); // READ — must be before any write

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
  }); // WRITE

  const txRef = adminDb.collection("transactions").doc();
  const txDoc: Omit<AppTransaction, "id"> = {
    userId,
    circleId: meta?.circleId ?? null,
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
  firestoreTx.set(txRef, txDoc); // WRITE

  return txRef.id;
}

// ─── confirmPending ───────────────────────────────────────────────────────────

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

// ─── addPending ───────────────────────────────────────────────────────────────

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

export function calculateWithdrawalFee(amountKobo: number): number {
  const percent = Math.round(amountKobo * 0.01);
  const flat = 5_000;  // ₦50
  const cap = 50_000;  // ₦500
  return Math.min(percent + flat, cap);
}

// ─── Guard ────────────────────────────────────────────────────────────────────

function assertPositive(amountKobo: number): void {
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
    throw new WalletError(
      "INVALID_AMOUNT",
      `Amount must be a positive number, got ${amountKobo}`
    );
  }
}