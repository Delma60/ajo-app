/**
 * Payment Service — Flutterwave integration.
 *
 * ─── FIRESTORE TRANSACTION READ-BEFORE-WRITE RULE ───────────────────────────
 * All tx.get() calls must complete before any tx.set() / tx.update() in the
 * same transaction. processSuccessfulDeposit() was violating this by calling
 * creditWalletBalance() (which called tx.get(walletRef)) after already calling
 * tx.update(pendingRef). Fixed by pre-reading both docs at the top of the
 * transaction before any writes are issued. creditWalletBalance() no longer
 * does a tx.get().
 *
 * ─── TWO DIFFERENT FLUTTERWAVE SECRETS ──────────────────────────────────────
 * FLUTTERWAVE_SECRET_KEY   → API key for initiating payments/transfers.
 * FLUTTERWAVE_SECRET_HASH  → Plain string for verifying webhook requests.
 *                            Set in Flutterwave dashboard → Settings → Webhooks.
 */

import { timingSafeEqual } from "node:crypto";
import { adminDb, admin } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  creditWallet,
  creditWalletBalance,
  debitWallet,
  calculateWithdrawalFee,
} from "@/lib/services/wallet-service";
import { sendNotification } from "@/lib/services/notification-service";
import { MIN_DEPOSIT_KOBO, MIN_WITHDRAW_KOBO } from "@/lib/constants";
import type { User, BankAccount } from "@/lib/types/user";
import type { Transaction } from "@/lib/types/transaction";
import type { Wallet } from "@/lib/types/wallet";

// ─── Flutterwave fetch helper ─────────────────────────────────────────────────

async function flwFetch(url: string, options: RequestInit): Promise<any> {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    throw new PaymentError(
      "FLW_PARSE_ERROR",
      `Flutterwave response was not valid JSON: ${text?.slice(0, 200)}`
    );
  }
  if (!res.ok || data.status === "error" || data.status === "failed") {
    throw new PaymentError(
      "FLW_API_ERROR",
      data.message || `Flutterwave API error: ${res.status}`
    );
  }
  return data;
}

// ─── Custom error ─────────────────────────────────────────────────────────────

export class PaymentError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FLW_API = "https://api.flutterwave.com/v3";
const REFERRAL_BONUS_KOBO = 50_000;        // ₦500
const REFERRAL_MIN_DEPOSIT_KOBO = 100_000; // ₦1,000
const REFERRAL_MONTHLY_LIMIT = 50;

// ─── Service ──────────────────────────────────────────────────────────────────

export class PaymentService {
  private readonly txCol = adminDb.collection("transactions");
  private readonly walletsCol = adminDb.collection("wallets");
  private readonly usersCol = adminDb.collection("users");

  // ─── Webhook signature ──────────────────────────────────────────────────────

  verifyWebhookSignature(_rawBody: string, signature: string | null): boolean {
    if (!signature) {
      console.warn("[payment-service] verif-hash header is missing");
      return false;
    }
    const secret = process.env.FLUTTERWAVE_SECRET_HASH;
    if (!secret) {
      console.error(
        "[payment-service] FLUTTERWAVE_SECRET_HASH env var is not set. " +
        "Add it to .env.local — it is the Secret Hash from your Flutterwave " +
        "dashboard (Settings → Webhooks), NOT the same as FLUTTERWAVE_SECRET_KEY."
      );
      return false;
    }
    try {
      const secretBuf = Buffer.from(secret);
      const signatureBuf = Buffer.from(signature);
      if (secretBuf.length !== signatureBuf.length) return false;
      return timingSafeEqual(secretBuf, signatureBuf);
    } catch {
      return false;
    }
  }

  // ─── Deposit ────────────────────────────────────────────────────────────────

  async initializeDeposit(
    userId: string,
    amountKobo: number,
    email: string,
    name: string,
    phone?: string
  ): Promise<{ paymentLink: string; reference: string }> {
    if (amountKobo < MIN_DEPOSIT_KOBO) {
      throw new PaymentError(
        "BELOW_MINIMUM",
        `Minimum deposit is ₦${MIN_DEPOSIT_KOBO / 100}.`
      );
    }
    const reference = `DEP-${userId.slice(0, 6)}-${Date.now()}`;
    await this.txCol.doc(reference).set({
      id: reference,
      userId,
      type: "deposit",
      direction: "credit",
      amount: amountKobo,
      fee: 0,
      netAmount: amountKobo,
      status: "pending",
      provider: "flutterwave",
      providerReference: null,
      reference,
      description: "Wallet funding",
      createdAt: FieldValue.serverTimestamp() as unknown as Timestamp,
      updatedAt: FieldValue.serverTimestamp() as unknown as Timestamp,
    } as Omit<Transaction, "id"> & { id: string });

    let data;
    try {
      data = await flwFetch(`${FLW_API}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tx_ref: reference,
          amount: amountKobo / 100,
          currency: "NGN",
          redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet/deposit/callback`,
          customer: { email, name, phone_number: phone },
          customizations: {
            title: "AjoSave Deposit",
            description: "Secure wallet funding",
            logo: `${process.env.NEXT_PUBLIC_APP_URL}/icon.png`,
          },
        }),
      });
    } catch (err: any) {
      await this.txCol.doc(reference).delete();
      console.error("[payment-service] Flutterwave init failed:", err);
      throw new PaymentError("PROVIDER_ERROR", err?.message ?? "Payment initialisation failed.");
    }

    if (!data.data?.link) {
      await this.txCol.doc(reference).delete();
      throw new PaymentError("PROVIDER_ERROR", data.message ?? "Payment initialisation failed.");
    }

    return { paymentLink: data.data.link, reference };
  }

  // ─── Webhook dispatcher ─────────────────────────────────────────────────────

  async handleWebhook(payload: Record<string, unknown>): Promise<void> {
    const event = payload.event as string;
    const data = payload.data as Record<string, unknown>;
    if (event === "charge.completed" && data?.status === "successful") {
      await this.processSuccessfulDeposit(data);
    } else if (event === "transfer.completed") {
      await this.processWithdrawalStatus(data, "success");
    } else if (event === "transfer.failed") {
      await this.processWithdrawalStatus(data, "failed");
    }
  }

  // ─── Withdrawal ─────────────────────────────────────────────────────────────

  async initiateWithdrawal(
    userId: string,
    amountKobo: number,
    bankAccountId: string
  ): Promise<{ reference: string }> {
    if (amountKobo < MIN_WITHDRAW_KOBO) {
      throw new PaymentError("BELOW_MINIMUM", `Minimum withdrawal is ₦${MIN_WITHDRAW_KOBO / 100}.`);
    }

    const [userSnap, walletSnap] = await Promise.all([
      this.usersCol.doc(userId).get(),
      this.walletsCol.doc(userId).get(),
    ]);

    if (!userSnap.exists) throw new PaymentError("NOT_FOUND", "User not found.");
    if (!walletSnap.exists) throw new PaymentError("NOT_FOUND", "Wallet not found.");

    const user = userSnap.data() as User;
    const wallet = walletSnap.data() as Wallet;
    const bankAccount = user.bankAccounts?.find((b: BankAccount) => b.id === bankAccountId);

    if (!bankAccount) throw new PaymentError("NOT_FOUND", "Bank account not found.");

    const fee = calculateWithdrawalFee(amountKobo);
    const netAmount = amountKobo - fee;

    if (wallet.available < amountKobo) {
      throw new PaymentError("INSUFFICIENT_FUNDS", `Insufficient balance. Available: ₦${wallet.available / 100}.`);
    }

    const reference = `WID-${userId.slice(0, 6)}-${Date.now()}`;

    await adminDb.runTransaction(async (tx) => {
      await debitWallet(tx, userId, amountKobo, "withdrawal",
        `Withdrawal to ${bankAccount.bankName} ····${bankAccount.accountNumber.slice(-4)}`,
        { reference, fee }
      );
    });

    let transferData;
    try {
      transferData = await flwFetch(`${FLW_API}/transfers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_bank: bankAccount.bankCode,
          account_number: bankAccount.accountNumber,
          amount: netAmount / 100,
          currency: "NGN",
          reference,
          narration: `AjoSave withdrawal for ${user.name}`,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`,
        }),
      });
    } catch (err: any) {
      await adminDb.runTransaction(async (tx) => {
        await creditWallet(tx, userId, amountKobo, "withdrawal",
          `Refund: failed withdrawal to ${bankAccount.bankName}`,
          { reference }
        );
      });
      const debitSnap = await this.txCol
        .where("reference", "==", reference)
        .where("direction", "==", "debit")
        .limit(1)
        .get();
      if (!debitSnap.empty) {
        await debitSnap.docs[0].ref.update({ status: "failed", updatedAt: FieldValue.serverTimestamp() });
      }
      throw new PaymentError("PROVIDER_ERROR", err?.message ?? "Transfer failed. Your funds have been refunded.");
    }

    void sendNotification(userId, {
      type: "general",
      title: "Withdrawal Initiated",
      body: `₦${(netAmount / 100).toLocaleString("en-NG")} is on its way to ${bankAccount.bankName} ····${bankAccount.accountNumber.slice(-4)}.`,
      link: "/wallet",
    });

    return { reference };
  }

  // ─── Private: successful deposit ────────────────────────────────────────────

  /**
   * FIX: All reads are issued before any writes.
   *
   * Before this fix, the transaction called tx.update(pendingRef) then
   * creditWalletBalance() which tried tx.get(walletRef) — violating Firestore's
   * "reads before writes" invariant.
   *
   * Fix: Pre-read pendingRef, walletRef, and all referral docs in Phase 1.
   * Then issue all writes in Phase 2. creditWalletBalance() is now write-only.
   */
  private async processSuccessfulDeposit(
    flwData: Record<string, unknown>
  ): Promise<void> {
    if (!flwData || typeof flwData !== "object") return;

    const providerReference = flwData.id ? String(flwData.id) : null;
    const txRef = flwData.tx_ref as string | undefined;
    const amountNaira = flwData.amount as number | undefined;

    if (!providerReference || !txRef || typeof amountNaira !== "number") {
      console.warn("[payment-service] Missing required fields in deposit webhook", {
        providerReference, txRef, amountNaira,
      });
      return;
    }

    const amountKobo = Math.round(amountNaira * 100);
    const pendingRef = this.txCol.doc(txRef);

    await adminDb.runTransaction(async (tx) => {

      // ── PHASE 1: ALL READS ──────────────────────────────────────────────────
      const pendingSnap = await tx.get(pendingRef);

      if (!pendingSnap.exists) {
        console.warn(`[payment-service] No pending tx for ref ${txRef} — skipping.`);
        return;
      }

      const pendingData = pendingSnap.data() as Transaction;

      if (pendingData.status !== "pending") {
        console.warn(`[payment-service] Tx ${txRef} already "${pendingData.status}" — duplicate webhook skipped.`);
        return;
      }

      const userId = pendingData.userId;

      // Pre-read the wallet so we can confirm it exists before writing
      const walletRef = this.walletsCol.doc(userId);
      const walletSnap = await tx.get(walletRef);

      if (!walletSnap.exists) {
        // Created at signup — this should never happen in production
        throw new Error(`[payment-service] Wallet missing for user ${userId}. Cannot credit deposit.`);
      }

      // Referral bonus reads — all before any write
      let referrerId: string | null = null;
      let shouldAwardBonus = false;

      if (amountKobo >= REFERRAL_MIN_DEPOSIT_KOBO) {
        const refereeSnap = await tx.get(this.usersCol.doc(userId));
        if (refereeSnap.exists) {
          const referee = refereeSnap.data() as User;
          if (referee?.referredBy) {
            const priorDepositsSnap = await this.txCol
              .where("userId", "==", userId)
              .where("type", "==", "deposit")
              .where("status", "==", "success")
              .get();

            if (priorDepositsSnap.size === 0) {
              const referrerSnap = await this.usersCol
                .where("referralCode", "==", referee.referredBy)
                .limit(1)
                .get();

              if (!referrerSnap.empty) {
                const potentialReferrerId = referrerSnap.docs[0].id;
                const startOfMonth = Timestamp.fromDate(
                  new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                );
                const monthlyBonusSnap = await this.txCol
                  .where("userId", "==", potentialReferrerId)
                  .where("type", "==", "referral_bonus")
                  .where("createdAt", ">=", startOfMonth)
                  .get();

                if (monthlyBonusSnap.size < REFERRAL_MONTHLY_LIMIT) {
                  referrerId = potentialReferrerId;
                  shouldAwardBonus = true;
                }
              }
            }
          }
        }
      }

      // ── PHASE 2: ALL WRITES (no tx.get() after this line) ──────────────────

      // 2a. Mark the pending deposit transaction as successful
      tx.update(pendingRef, {
        status: "success",
        providerReference,
        amount: amountKobo,
        netAmount: amountKobo,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 2b. Credit wallet balance (write-only — no tx.get inside)
      await creditWalletBalance(tx, userId, amountKobo, "deposit");

      // 2c. Referral bonus (write-only)
      if (shouldAwardBonus && referrerId) {
        const bonusTxRef = this.txCol.doc();
        tx.set(bonusTxRef, {
          userId: referrerId,
          circleId: null,
          type: "referral_bonus",
          direction: "credit",
          amount: REFERRAL_BONUS_KOBO,
          fee: 0,
          netAmount: REFERRAL_BONUS_KOBO,
          status: "success",
          reference: bonusTxRef.id,
          description: `Referral bonus — new member made first deposit`,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        tx.update(this.walletsCol.doc(referrerId), {
          available: FieldValue.increment(REFERRAL_BONUS_KOBO),
          referralEarnings: FieldValue.increment(REFERRAL_BONUS_KOBO),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    // Post-transaction notification (outside tx — fire and forget)
    const confirmedSnap = await pendingRef.get();
    const uid = confirmedSnap.data()?.userId as string | undefined;
    if (uid && confirmedSnap.data()?.status === "success") {
      void sendNotification(uid, {
        type: "general",
        title: "Deposit Confirmed",
        body: `₦${(amountKobo / 100).toLocaleString("en-NG")} has been added to your wallet.`,
        link: "/wallet",
      });
    }
  }

  // ─── Private: withdrawal status ─────────────────────────────────────────────

  private async processWithdrawalStatus(
    flwData: Record<string, unknown>,
    outcome: "success" | "failed"
  ): Promise<void> {
    if (!flwData || typeof flwData !== "object") return;

    const reference = flwData.reference as string | undefined;
    if (!reference) {
      console.warn("[payment-service] Missing reference in withdrawal webhook", flwData);
      return;
    }

    const txSnap = await this.txCol
      .where("reference", "==", reference)
      .where("direction", "==", "debit")
      .limit(1)
      .get();

    if (txSnap.empty) {
      console.warn(`[payment-service] No withdrawal transaction found for ref ${reference}`);
      return;
    }

    const txDoc = txSnap.docs[0];
    const txData = txDoc.data() as Transaction;
    if (txData.status !== "pending") return;

    if (outcome === "failed") {
      await adminDb.runTransaction(async (tx) => {
        // tx.update on txDoc.ref then creditWallet does tx.get on walletRef —
        // these are different documents so the read/write ordering is fine.
        // But to be safe, reorder: creditWallet (read+write wallet) first,
        // then update txDoc (write txDoc).
        await creditWallet(
          tx,
          txData.userId,
          txData.amount,
          "withdrawal",
          `Refund: withdrawal failed`,
          { reference }
        );
        tx.update(txDoc.ref, {
          status: "failed",
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      void sendNotification(txData.userId, {
        type: "general",
        title: "Withdrawal Failed",
        body: `Your withdrawal of ₦${(txData.amount / 100).toLocaleString("en-NG")} failed. The amount has been refunded.`,
        link: "/wallet",
      });
    } else {
      await txDoc.ref.update({
        status: "success",
        providerReference: flwData.id ? String(flwData.id) : undefined,
        updatedAt: FieldValue.serverTimestamp(),
      });
      void sendNotification(txData.userId, {
        type: "general",
        title: "Withdrawal Successful",
        body: `₦${(txData.netAmount / 100).toLocaleString("en-NG")} has been sent to your bank account.`,
        link: "/wallet",
      });
    }
  }
}