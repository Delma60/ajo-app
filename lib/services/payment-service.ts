/**
 * Payment Service — Flutterwave integration.
 *
 * Deposit flow:
 *   1. initializeDeposit() → creates pending tx → returns Flutterwave payment link
 *   2. handleWebhook() → charge.completed → processSuccessfulDeposit()
 *      - Idempotency check on providerReference inside runTransaction()
 *      - Credits wallet, awards referral bonus if eligible
 *
 * Withdrawal flow:
 *   1. initiateWithdrawal() → validates, debits wallet inside transaction
 *   2. handleWebhook() → transfer.completed / transfer.failed
 *      - On failed: refunds gross amount
 *
 * All amounts are in kobo (1 NGN = 100 kobo).
 */

import crypto from "crypto";
import { adminDb, admin } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  creditWallet,
  debitWallet,
  calculateWithdrawalFee,
  WalletError,
} from "@/lib/services/wallet-service";
import { sendNotification } from "@/lib/services/notification-service";
import { MIN_DEPOSIT_KOBO, MIN_WITHDRAW_KOBO } from "@/lib/constants";
import type { User, BankAccount } from "@/lib/types/user";
import type { Transaction } from "@/lib/types/transaction";
import type { Wallet } from "@/lib/types/wallet";

// ─── Custom error ─────────────────────────────────────────────────────────────

export class PaymentError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FLW_API = "https://api.flutterwave.com/v3";
const REFERRAL_BONUS_KOBO = 50_000; // ₦500
const REFERRAL_MIN_DEPOSIT_KOBO = 100_000; // ₦1,000
const REFERRAL_MONTHLY_LIMIT = 50;

// ─── Service ──────────────────────────────────────────────────────────────────

export class PaymentService {
  private readonly txCol = adminDb.collection("transactions");
  private readonly walletsCol = adminDb.collection("wallets");
  private readonly usersCol = adminDb.collection("users");

  // ─── Webhook signature ─────────────────────────────────────────────────────

  verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
    if (!signature) return false;
    const secret = process.env.FLUTTERWAVE_SECRET_KEY!;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  // ─── Deposit ───────────────────────────────────────────────────────────────

  /**
   * Initialise a Flutterwave deposit. Creates a pending transaction and
   * returns the hosted payment link.
   */
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

    // Create pending transaction before redirecting
    await this.txCol.doc(reference).set({
      userId,
      type: "deposit",
      direction: "credit",
      amount: amountKobo,
      fee: 0,
      netAmount: amountKobo,
      status: "pending",
      provider: "flutterwave",
      reference,
      description: "Wallet funding",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const res = await fetch(`${FLW_API}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: reference,
        amount: amountKobo / 100,
        currency: "NGN",
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet`,
        customer: { email, name, phone_number: phone },
        customizations: {
          title: "AjoSave Deposit",
          description: "Secure wallet funding",
          logo: `${process.env.NEXT_PUBLIC_APP_URL}/icon.png`,
        },
      }),
    });

    const data = await res.json();
    if (data.status !== "success" || !data.data?.link) {
      console.error("[payment-service] Flutterwave init failed:", data);
      throw new PaymentError("PROVIDER_ERROR", data.message ?? "Payment initialisation failed.");
    }

    return { paymentLink: data.data.link, reference };
  }

  // ─── Webhook dispatcher ────────────────────────────────────────────────────

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
    // All other events are acknowledged but not processed
  }

  // ─── Withdrawal ────────────────────────────────────────────────────────────

  /**
   * Validate, debit wallet, and dispatch a Flutterwave Transfer.
   * The webhook will handle final success/failure status updates.
   */
  async initiateWithdrawal(
    userId: string,
    amountKobo: number,
    bankAccountId: string
  ): Promise<{ reference: string }> {
    if (amountKobo < MIN_WITHDRAW_KOBO) {
      throw new PaymentError(
        "BELOW_MINIMUM",
        `Minimum withdrawal is ₦${MIN_WITHDRAW_KOBO / 100}.`
      );
    }

    // Fetch user and wallet outside the transaction for validation reads
    const [userSnap, walletSnap] = await Promise.all([
      this.usersCol.doc(userId).get(),
      this.walletsCol.doc(userId).get(),
    ]);

    if (!userSnap.exists) throw new PaymentError("NOT_FOUND", "User not found.");
    if (!walletSnap.exists) throw new PaymentError("NOT_FOUND", "Wallet not found.");

    const user = userSnap.data() as User;
    const wallet = walletSnap.data() as Wallet;
    const bankAccount = user.bankAccounts?.find((b: BankAccount) => b.id === bankAccountId);

    if (!bankAccount) {
      throw new PaymentError("NOT_FOUND", "Bank account not found.");
    }

    const fee = calculateWithdrawalFee(amountKobo);
    const netAmount = amountKobo - fee;

    if (wallet.available < amountKobo) {
      throw new PaymentError(
        "INSUFFICIENT_FUNDS",
        `Insufficient balance. Available: ₦${wallet.available / 100}.`
      );
    }

    const reference = `WID-${userId.slice(0, 6)}-${Date.now()}`;

    // Atomically debit the wallet and create the transaction record
    await adminDb.runTransaction(async (tx) => {
      await debitWallet(tx, userId, amountKobo, "withdrawal", `Withdrawal to ${bankAccount.bankName}`, {
        reference,
        fee,
      });
    });

    // Dispatch Flutterwave Transfer (outside transaction — not atomic by design)
    const transferRes = await fetch(`${FLW_API}/transfers`, {
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

    const transferData = await transferRes.json();

    if (transferData.status !== "success") {
      // Flutterwave rejected the transfer — refund the deducted amount
      console.error("[payment-service] Flutterwave transfer failed:", transferData);
      await adminDb.runTransaction(async (tx) => {
        await creditWallet(
          tx, userId, amountKobo, "withdrawal",
          `Refund: failed withdrawal to ${bankAccount.bankName}`,
          { reference }
        );
      });
      // Update the transaction record to failed
      await this.txCol
        .where("reference", "==", reference)
        .limit(1)
        .get()
        .then((snap) => {
          if (!snap.empty) {
            snap.docs[0].ref.update({ status: "failed", updatedAt: FieldValue.serverTimestamp() });
          }
        });

      throw new PaymentError(
        "PROVIDER_ERROR",
        transferData.message ?? "Transfer failed. Your funds have been refunded."
      );
    }

    void sendNotification(userId, {
      type: "general",
      title: "Withdrawal Initiated",
      body: `₦${netAmount / 100} is on its way to ${bankAccount.bankName} ····${bankAccount.accountNumber.slice(-4)}.`,
      link: "/wallet",
    });

    return { reference };
  }

  // ─── Private processors ────────────────────────────────────────────────────

  private async processSuccessfulDeposit(flwData: Record<string, unknown>): Promise<void> {
    const providerReference = String(flwData.id);
    const txRef = flwData.tx_ref as string;
    const amountKobo = Math.round((flwData.amount as number) * 100);

    await adminDb.runTransaction(async (tx) => {
      // ── Idempotency check ──────────────────────────────────────────────────
      // Prevents double-crediting on duplicate webhook delivery.
      const existingSnap = await tx.get(
        this.txCol.where("providerReference", "==", providerReference).limit(1) as any
      );
      // Firestore transactions don't support queries directly — use getDocs outside,
      // then verify inside. Pattern: check in the non-transactional read below,
      // then do an atomic verify-and-write inside.
      // We store the providerReference on the pending tx so we can check it.

      const pendingSnap = await this.txCol
        .where("reference", "==", txRef)
        .limit(1)
        .get();

      if (pendingSnap.empty) {
        console.warn(`[payment-service] No pending transaction for ref ${txRef}`);
        return;
      }

      const pendingDoc = pendingSnap.docs[0];
      const pendingData = pendingDoc.data() as Transaction;

      if (pendingData.status !== "pending") {
        console.warn(`[payment-service] Transaction ${txRef} already processed — skipping.`);
        return;
      }
      if (pendingData.providerReference && pendingData.providerReference !== providerReference) {
        console.warn(`[payment-service] providerReference mismatch for ${txRef} — skipping.`);
        return;
      }

      const userId = pendingData.userId;

      // Mark transaction as success
      tx.update(pendingDoc.ref, {
        status: "success",
        providerReference,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Credit wallet
      await creditWallet(tx, userId, amountKobo, "deposit", "Wallet funding confirmed", {
        reference: txRef,
        providerReference,
      });

      // Attempt referral bonus (best-effort — failure must not block the deposit)
      try {
        await this.maybeAwardReferralBonus(tx, userId, amountKobo);
      } catch (err) {
        console.error("[payment-service] Referral bonus failed (non-fatal):", err);
      }
    });

    // Notify user after transaction commits
    const txSnap = await this.txCol.where("reference", "==", txRef).limit(1).get();
    if (!txSnap.empty) {
      const { userId, amount } = txSnap.docs[0].data() as Transaction;
      void sendNotification(userId, {
        type: "general",
        title: "Deposit Confirmed",
        body: `₦${amount / 100} has been added to your wallet.`,
        link: "/wallet",
      });
    }
  }

  private async processWithdrawalStatus(
    flwData: Record<string, unknown>,
    outcome: "success" | "failed"
  ): Promise<void> {
    const reference = flwData.reference as string;

    const txSnap = await this.txCol
      .where("reference", "==", reference)
      .limit(1)
      .get();

    if (txSnap.empty) {
      console.warn(`[payment-service] No transaction found for withdrawal ref ${reference}`);
      return;
    }

    const txDoc = txSnap.docs[0];
    const txData = txDoc.data() as Transaction;

    if (txData.status !== "pending") return; // Already processed

    if (outcome === "failed") {
      // Refund the gross amount that was deducted
      await adminDb.runTransaction(async (tx) => {
        tx.update(txDoc.ref, { status: "failed", updatedAt: FieldValue.serverTimestamp() });
        await creditWallet(
          tx, txData.userId, txData.amount, "withdrawal",
          "Refund: withdrawal failed",
          { reference }
        );
      });

      void sendNotification(txData.userId, {
        type: "general",
        title: "Withdrawal Failed",
        body: `Your withdrawal of ₦${txData.amount / 100} failed. The amount has been refunded to your wallet.`,
        link: "/wallet",
      });
    } else {
      await txDoc.ref.update({
        status: "success",
        providerReference: String(flwData.id),
        updatedAt: FieldValue.serverTimestamp(),
      });

      void sendNotification(txData.userId, {
        type: "general",
        title: "Withdrawal Successful",
        body: `₦${txData.netAmount / 100} has been sent to your bank account.`,
        link: "/wallet",
      });
    }
  }

  /**
   * Award a ₦500 referral bonus to the referrer when:
   *  - The referee deposits ≥ ₦1,000 for the first time
   *  - The referrer hasn't hit the monthly cap of 50 bonuses
   *
   * Must be called inside an existing Firestore transaction.
   */
  private async maybeAwardReferralBonus(
    tx: admin.firestore.Transaction,
    refereeId: string,
    depositAmountKobo: number
  ): Promise<void> {
    if (depositAmountKobo < REFERRAL_MIN_DEPOSIT_KOBO) return;

    const refereeSnap = await this.usersCol.doc(refereeId).get();
    const referee = refereeSnap.data() as User;

    if (!referee?.referredBy) return;

    // Only award on the first successful deposit
    const priorDepositsSnap = await this.txCol
      .where("userId", "==", refereeId)
      .where("type", "==", "deposit")
      .where("status", "==", "success")
      .get();

    // At this point the current deposit hasn't been marked "success" yet
    // (we're inside the transaction), so priorDepositsSnap.size === 0 means first deposit.
    if (priorDepositsSnap.size > 0) return;

    // Look up the referrer by referral code
    const referrerSnap = await this.usersCol
      .where("referralCode", "==", referee.referredBy)
      .limit(1)
      .get();

    if (referrerSnap.empty) return;

    const referrerId = referrerSnap.docs[0].id;

    // Monthly cap check
    const startOfMonth = Timestamp.fromDate(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    const monthlyBonusSnap = await this.txCol
      .where("userId", "==", referrerId)
      .where("type", "==", "referral_bonus")
      .where("createdAt", ">=", startOfMonth)
      .get();

    if (monthlyBonusSnap.size >= REFERRAL_MONTHLY_LIMIT) return;

    await creditWallet(
      tx, referrerId, REFERRAL_BONUS_KOBO, "referral_bonus",
      `Referral bonus — ${referee.name} made their first deposit`
    );
  }
}