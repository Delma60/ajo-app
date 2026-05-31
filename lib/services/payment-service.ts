/**
 * Payment Service — Flutterwave integration.
 *
 * Deposit flow:
 *   1. initializeDeposit()
 *        → creates transactions/{reference} with status "pending"
 *        → returns Flutterwave payment link
 *   2. handleWebhook() → charge.completed → processSuccessfulDeposit()
 *        → updates the SAME transactions/{reference} doc to status "success"
 *        → credits the wallet balance only (no new transaction doc created)
 *        → awards referral bonus if eligible (creates its own referral_bonus tx)
 *
 * This ensures exactly ONE transaction record per deposit.
 *
 * Withdrawal flow:
 *   1. initiateWithdrawal()
 *        → validates, debits wallet inside transaction (creates withdrawal tx doc)
 *   2. handleWebhook() → transfer.completed / transfer.failed
 *        → on failed: refunds gross amount (creates a new credit tx doc)
 *
 * All amounts are in kobo (1 NGN = 100 kobo).
 */

import crypto from "crypto";
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
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  }

  // ─── Deposit ───────────────────────────────────────────────────────────────

  /**
   * Initialise a Flutterwave deposit.
   *
   * Creates a SINGLE pending transaction document keyed by `reference`.
   * The webhook will update this same document to "success" — no second
   * document is ever written for the deposit itself.
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

    // Use the reference as the Firestore document ID so the webhook can
    // locate and update it with a simple .doc(reference).get() — no query needed.
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
      providerReference: null, // filled in by the webhook
      reference,
      description: "Wallet funding",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    } satisfies Omit<Transaction, "id"> & { id: string });

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
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/wallet/deposit/callback`,
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
      // Clean up the pending record so it doesn't become an orphan
      await this.txCol.doc(reference).delete();
      console.error("[payment-service] Flutterwave init failed:", data);
      throw new PaymentError(
        "PROVIDER_ERROR",
        data.message ?? "Payment initialisation failed."
      );
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
    // All other events acknowledged, not processed
  }

  // ─── Withdrawal ────────────────────────────────────────────────────────────

  /**
   * Validate, debit wallet, and dispatch a Flutterwave Transfer.
   * The webhook handles final success/failure status updates.
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
      throw new PaymentError(
        "INSUFFICIENT_FUNDS",
        `Insufficient balance. Available: ₦${wallet.available / 100}.`
      );
    }

    const reference = `WID-${userId.slice(0, 6)}-${Date.now()}`;

    // Atomically debit wallet and create the withdrawal transaction record
    await adminDb.runTransaction(async (tx) => {
      await debitWallet(
        tx,
        userId,
        amountKobo,
        "withdrawal",
        `Withdrawal to ${bankAccount.bankName} ····${bankAccount.accountNumber.slice(-4)}`,
        { reference, fee }
      );
    });

    // Dispatch Flutterwave Transfer (outside transaction — intentional)
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
      console.error("[payment-service] Flutterwave transfer rejected:", transferData);

      // Refund the deducted amount immediately
      await adminDb.runTransaction(async (tx) => {
        await creditWallet(
          tx,
          userId,
          amountKobo,
          "withdrawal",
          `Refund: failed withdrawal to ${bankAccount.bankName}`,
          { reference }
        );
      });

      // Mark the debit transaction as failed
      const debitSnap = await this.txCol
        .where("reference", "==", reference)
        .where("direction", "==", "debit")
        .limit(1)
        .get();
      if (!debitSnap.empty) {
        await debitSnap.docs[0].ref.update({
          status: "failed",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      throw new PaymentError(
        "PROVIDER_ERROR",
        transferData.message ?? "Transfer failed. Your funds have been refunded."
      );
    }

    void sendNotification(userId, {
      type: "general",
      title: "Withdrawal Initiated",
      body: `₦${(netAmount / 100).toLocaleString("en-NG")} is on its way to ${bankAccount.bankName} ····${bankAccount.accountNumber.slice(-4)}.`,
      link: "/wallet",
    });

    return { reference };
  }

  // ─── Private: successful deposit ───────────────────────────────────────────

  /**
   * Handles a confirmed Flutterwave charge.completed webhook.
   *
   * Strategy (one document per deposit):
   *   1. Locate the existing pending transaction doc by `tx_ref` (= our reference).
   *   2. Guard: skip if already processed (idempotency).
   *   3. Inside a Firestore transaction:
   *        a. Update the pending doc to status "success" + stamp providerReference.
   *        b. Credit the wallet balance via creditWalletBalance() — wallet only,
   *           no new transaction doc created.
   *        c. Optionally award referral bonus (that creates its own separate tx doc).
   */
  private async processSuccessfulDeposit(
    flwData: Record<string, unknown>
  ): Promise<void> {
    const providerReference = String(flwData.id); // Flutterwave transaction ID
    const txRef = flwData.tx_ref as string; // our internal reference
    const amountNaira = flwData.amount as number;
    const amountKobo = Math.round(amountNaira * 100);

    // ── Locate the pending transaction doc ────────────────────────────────────
    // We store the doc under the reference ID directly, so no query needed.
    const pendingRef = this.txCol.doc(txRef);

    await adminDb.runTransaction(async (tx) => {
      const pendingSnap = await tx.get(pendingRef);

      if (!pendingSnap.exists) {
        console.warn(
          `[payment-service] No pending transaction found for ref ${txRef} — skipping.`
        );
        return;
      }

      const pendingData = pendingSnap.data() as Transaction;

      // ── Idempotency guard ──────────────────────────────────────────────────
      // If the status is anything other than "pending", this webhook has already
      // been processed (duplicate delivery). Return immediately without changes.
      if (pendingData.status !== "pending") {
        console.warn(
          `[payment-service] Transaction ${txRef} already has status "${pendingData.status}" — skipping duplicate webhook.`
        );
        return;
      }

      const userId = pendingData.userId;

      // ── 1. Update the existing pending doc to "success" ────────────────────
      // This is the ONLY write to the transactions collection for this deposit.
      tx.update(pendingRef, {
        status: "success",
        providerReference,
        // Reconcile the amount from Flutterwave in case it differs (e.g. partial)
        amount: amountKobo,
        netAmount: amountKobo,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // ── 2. Credit the wallet balance — no new transaction doc ──────────────
      await creditWalletBalance(tx, userId, amountKobo, "deposit");

      // ── 3. Referral bonus (best-effort, creates its own tx doc) ────────────
      try {
        await this.maybeAwardReferralBonus(tx, userId, amountKobo);
      } catch (err) {
        console.error(
          "[payment-service] Referral bonus failed (non-fatal):",
          err
        );
      }
    });

    // ── Notify user after the transaction commits ──────────────────────────
    void sendNotification(
      (await pendingRef.get()).data()?.userId as string,
      {
        type: "general",
        title: "Deposit Confirmed",
        body: `₦${(amountKobo / 100).toLocaleString("en-NG")} has been added to your wallet.`,
        link: "/wallet",
      }
    );
  }

  // ─── Private: withdrawal status ────────────────────────────────────────────

  private async processWithdrawalStatus(
    flwData: Record<string, unknown>,
    outcome: "success" | "failed"
  ): Promise<void> {
    const reference = flwData.reference as string;

    // Find the withdrawal debit transaction
    const txSnap = await this.txCol
      .where("reference", "==", reference)
      .where("direction", "==", "debit")
      .limit(1)
      .get();

    if (txSnap.empty) {
      console.warn(
        `[payment-service] No withdrawal transaction found for ref ${reference}`
      );
      return;
    }

    const txDoc = txSnap.docs[0];
    const txData = txDoc.data() as Transaction;

    // Idempotency: already finalised
    if (txData.status !== "pending") return;

    if (outcome === "failed") {
      // Refund the gross amount that was debited
      await adminDb.runTransaction(async (tx) => {
        tx.update(txDoc.ref, {
          status: "failed",
          updatedAt: FieldValue.serverTimestamp(),
        });
        await creditWallet(
          tx,
          txData.userId,
          txData.amount,
          "withdrawal",
          `Refund: withdrawal failed`,
          { reference }
        );
      });

      void sendNotification(txData.userId, {
        type: "general",
        title: "Withdrawal Failed",
        body: `Your withdrawal of ₦${(txData.amount / 100).toLocaleString("en-NG")} failed. The amount has been refunded to your wallet.`,
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
        body: `₦${(txData.netAmount / 100).toLocaleString("en-NG")} has been sent to your bank account.`,
        link: "/wallet",
      });
    }
  }

  // ─── Private: referral bonus ───────────────────────────────────────────────

  /**
   * Award a ₦500 referral bonus to the referrer when:
   *  - The referee deposits ≥ ₦1,000 for the first time
   *  - The referrer hasn't hit the monthly cap of 50 bonuses
   *
   * Must be called inside an existing Firestore transaction.
   * Creates its own referral_bonus transaction document — this is intentional
   * and distinct from the deposit transaction.
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

    // Only award on the referee's very first deposit.
    // At this point inside the transaction, the current deposit doc has been
    // updated to "success" but Firestore reads within the same transaction still
    // see the pre-transaction snapshot — so we query for prior success deposits
    // outside this field. Count of success deposits before this one = 0 means first.
    const priorDepositsSnap = await this.txCol
      .where("userId", "==", refereeId)
      .where("type", "==", "deposit")
      .where("status", "==", "success")
      .get();

    // priorDepositsSnap will be 0 for the first-ever deposit (the current one
    // hasn't been committed yet when this read executes inside the transaction).
    if (priorDepositsSnap.size > 0) return;

    // Look up the referrer by their referral code
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

    // creditWallet creates a new referral_bonus transaction doc — correct behaviour.
    await creditWallet(
      tx,
      referrerId,
      REFERRAL_BONUS_KOBO,
      "referral_bonus",
      `Referral bonus — ${referee.name} made their first deposit`
    );
  }
}