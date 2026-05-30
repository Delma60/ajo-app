import crypto from "crypto";
import { admin, adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
// import { Transaction, Wallet, User } from "@/lib/types";
import {
  MIN_DEPOSIT_KOBO,
  MIN_WITHDRAW_KOBO,
  WITHDRAW_FEE_FLAT,
  WITHDRAW_FEE_PERCENT,
} from "@/lib/constants";
import * as notificationService from "@/lib/services/notification-service";
import { Transaction } from "../types/transaction";
import { User } from "../types/user";
import { Wallet } from "../types/wallet";

class CustomError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "CustomError";
  }
}

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

const REFERRAL_BONUS_KOBO = 50000; // ₦500
const REFERRAL_MIN_DEPOSIT_KOBO = 100000; // ₦1,000
const REFERRAL_MONTHLY_LIMIT = 50;

export class PaymentService {
  private transactionsCollection = adminDb.collection("transactions");
  private walletsCollection = adminDb.collection("wallets");
  private usersCollection = adminDb.collection("users");

  /**
   * Verifies the Flutterwave webhook signature for security.
   */
  public verifyWebhookSignature(payload: any, signature: string | null): boolean {
    if (!signature) return false;
    const hash = crypto
      .createHmac("sha256", FLUTTERWAVE_SECRET_KEY!)
      .update(JSON.stringify(payload))
      .digest("hex");

    return hash === signature;
  }

  /**
   * Initializes a deposit by creating a pending transaction and a Flutterwave payment link.
   */
  public async initializeDeposit(
    userId: string,
    amountKobo: number,
    email: string,
    name: string
  ): Promise<{ link: string; reference: string }> {
    if (amountKobo < MIN_DEPOSIT_KOBO) {
      throw new CustomError("InvalidAmount", `Minimum deposit is ₦${MIN_DEPOSIT_KOBO / 100}`);
    }

    const reference = `DEP-${userId.slice(0, 5)}-${Date.now()}`;

    // 1. Create a pending transaction record
    const transactionRef = this.transactionsCollection.doc();
    await transactionRef.set({
      userId,
      type: "deposit",
      direction: "credit",
      amount: amountKobo,
      fee: 0,
      netAmount: amountKobo,
      status: "pending",
      provider: "flutterwave",
      reference: reference,
      description: "Wallet Funding",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 2. Call Flutterwave to generate payment link
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: reference,
        amount: amountKobo / 100,
        currency: "NGN",
        redirect_url: `${APP_URL}/wallet`,
        customer: { email, name },
        customizations: {
          title: "AjoSave Deposit",
          description: "Secure wallet funding",
        },
      }),
    });

    const data = await response.json();
    if (data.status !== "success") {
      throw new Error(data.message || "Flutterwave initialization failed");
    }

    return { link: data.data.link, reference };
  }

  /**
   * Entry point for processing Flutterwave webhooks.
   */
  public async handleWebhook(payload: any): Promise<void> {
    const { event, data } = payload;

    if (event === "charge.completed" && data.status === "successful") {
      await this.processSuccessfulDeposit(data);
    } else if (event?.startsWith("transfer.")) {
      const status = event === "transfer.completed" ? "success" : "failed";
      await this.processWithdrawalStatus(data, status);
    }
  }

  private async processSuccessfulDeposit(flwData: any): Promise<void> {
    const providerReference = String(flwData.id);
    const txRef = flwData.tx_ref;
    const amountKobo = Math.round(flwData.amount * 100);

    await adminDb.runTransaction(async (transaction) => {
      // Idempotency check: Ensure provider reference hasn't been processed
      const existingTx = await transaction.get(
        this.transactionsCollection.where("providerReference", "==", providerReference).limit(1)
      );
      if (!existingTx.empty) return;

      // Find original pending transaction
      const pendingTxSnap = await transaction.get(
        this.transactionsCollection.where("reference", "==", txRef).limit(1)
      );
      if (pendingTxSnap.empty) return;

      const txDoc = pendingTxSnap.docs[0];
      const txData = txDoc.data() as Transaction;
      if (txData.status !== "pending") return;

      const userId = txData.userId;

      // Update transaction status
      transaction.update(txDoc.ref, {
        status: "success",
        providerReference,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Increment wallet balance
      const walletRef = this.walletsCollection.doc(userId);
      transaction.update(walletRef, {
        available: FieldValue.increment(amountKobo),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Referral processing
      await this.processReferralBonus(transaction, userId, amountKobo);
    });
  }

  private async processReferralBonus(
    transaction: admin.firestore.Transaction,
    refereeId: string,
    depositAmountKobo: number
  ): Promise<void> {
    if (depositAmountKobo < REFERRAL_MIN_DEPOSIT_KOBO) return;

    const userRef = this.usersCollection.doc(refereeId);
    const userSnap = await transaction.get(userRef);
    const user = userSnap.data() as User;

    if (!user || !user.referredBy) return;

    // Check if this is the first successful deposit
    const depositQuery = this.transactionsCollection
      .where("userId", "==", refereeId)
      .where("type", "==", "deposit")
      .where("status", "==", "success");
    const deposits = await transaction.get(depositQuery);
    
    // Size 1 because we just committed the current one in this transaction
    if (deposits.size > 1) return;

    const referrerSnap = await transaction.get(
      this.usersCollection.where("referralCode", "==", user.referredBy).limit(1)
    );
    if (referrerSnap.empty) return;

    const referrerDoc = referrerSnap.docs[0];
    const referrerId = referrerDoc.id;

    // Monthly fraud limit check
    const startOfMonth = Timestamp.fromDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const countSnap = await transaction.get(
      this.transactionsCollection
        .where("userId", "==", referrerId)
        .where("type", "==", "referral_bonus")
        .where("createdAt", ">=", startOfMonth)
    );

    if (countSnap.size >= REFERRAL_MONTHLY_LIMIT) return;

    // Award bonus
    transaction.update(this.walletsCollection.doc(referrerId), {
      available: FieldValue.increment(REFERRAL_BONUS_KOBO),
      referralEarnings: FieldValue.increment(REFERRAL_BONUS_KOBO),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const bonusTxRef = this.transactionsCollection.doc();
    transaction.set(bonusTxRef, {
      userId: referrerId,
      type: "referral_bonus",
      direction: "credit",
      amount: REFERRAL_BONUS_KOBO,
      fee: 0,
      netAmount: REFERRAL_BONUS_KOBO,
      status: "success",
      reference: bonusTxRef.id,
      description: `Referral bonus for ${user.name}`,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  public async initiateWithdrawal(userId: string, amountKobo: number, bankAccountId: string): Promise<void> {
    if (amountKobo < MIN_WITHDRAW_KOBO) {
      throw new CustomError("InvalidAmount", `Minimum withdrawal is ₦${MIN_WITHDRAW_KOBO / 100}`);
    }

    const { txRef, bankAccount, netAmount } = await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(this.usersCollection.doc(userId));
      const walletSnap = await transaction.get(this.walletsCollection.doc(userId));
      const user = userSnap.data() as User;
      const wallet = walletSnap.data() as Wallet;

      if (wallet.available < amountKobo) throw new CustomError("InsufficientFunds", "Insufficient balance");
      const bank = user.bankAccounts.find(b => b.id === bankAccountId);
      if (!bank) throw new CustomError("NotFound", "Bank account not found");

      // 1% + ₦50, capped at ₦500
      const percent = Math.round(amountKobo * (WITHDRAW_FEE_PERCENT / 100));
      let fee = percent + WITHDRAW_FEE_FLAT;
      if (fee > 50000) fee = 50000;

      const internalRef = `WID-${userId.slice(0, 5)}-${Date.now()}`;

      transaction.update(this.walletsCollection.doc(userId), {
        available: FieldValue.increment(-amountKobo),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const txDoc = this.transactionsCollection.doc();
      transaction.set(txDoc, {
        userId,
        type: "withdrawal",
        direction: "debit",
        amount: amountKobo,
        fee,
        netAmount: amountKobo - fee,
        status: "pending",
        reference: internalRef,
        description: `Withdrawal to ${bank.bankName}`,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { txRef: internalRef, bankAccount: bank, netAmount: amountKobo - fee };
    });

    // Finalize via Flutterwave Transfer API
    await fetch("https://api.flutterwave.com/v3/transfers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_bank: bankAccount.bankCode,
        account_number: bankAccount.accountNumber,
        amount: netAmount / 100,
        currency: "NGN",
        reference: txRef,
        callback_url: `${APP_URL}/api/payments/webhook`,
      }),
    });
  }

  private async processWithdrawalStatus(flwData: any, status: "success" | "failed"): Promise<void> {
    const txRef = flwData.reference;
    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(this.transactionsCollection.where("reference", "==", txRef).limit(1));
      if (snap.empty) return;
      const txDoc = snap.docs[0];
      const txData = txDoc.data() as Transaction;
      if (txData.status !== "pending") return;

      if (status === "failed") {
        // Refund gross amount
        transaction.update(this.walletsCollection.doc(txData.userId), {
          available: FieldValue.increment(txData.amount),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(txDoc.ref, { status: "failed", updatedAt: FieldValue.serverTimestamp() });
      } else {
        transaction.update(txDoc.ref, {
          status: "success",
          providerReference: String(flwData.id),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });
  }
}