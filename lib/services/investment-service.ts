/**
 * Investment Service
 * Handles the full lifecycle of user investments:
 * create → active → matured → withdrawn
 *
 * Rules:
 * - Minimum deposit per package enforced at write time
 * - Principal debited from wallet on creation (type: "investment_deposit")
 * - Returns credited to wallet on withdrawal (type: "investment_return")
 * - Early withdrawal not permitted — maturity date must have passed
 * - Expected return = principal + (principal × annual_yield × days / 365)
 * - Platform takes 1% of interest earned as fee on withdrawal
 * - Positions are immutable after creation (no top-ups)
 */

import { adminDb, admin } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { debitWallet, creditWallet } from "@/lib/services/wallet-service";
import { sendNotification } from "@/lib/services/notification-service";
import { getInvestmentSettings } from "@/lib/services/settings-service";
import type {
  Investment,
  InvestmentPackage,
  InvestmentPortfolioSummary,
  InvestmentWithProgress,
} from "@/lib/types/investment";
import { INVESTMENT_PACKAGES } from "@/lib/types/investment";

// ─── Custom error ─────────────────────────────────────────────────────────────

export class InvestmentError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "InvestmentError";
  }
}

// ─── Settings (loaded at runtime from admin settings) ────────────────────────

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcExpectedReturn(
  principalKobo: number,
  annualYieldPercent: number,
  durationDays: number
): { expectedReturnKobo: number; interestKobo: number } {
  const interest = Math.round(
    (principalKobo * (annualYieldPercent / 100) * durationDays) / 365
  );
  return {
    interestKobo: interest,
    expectedReturnKobo: principalKobo + interest,
  };
}

export function enrichInvestment(inv: Investment): InvestmentWithProgress {
  const now = Date.now();
  const start = inv.startDate.toMillis();
  const maturity = inv.maturityDate.toMillis();
  const totalMs = maturity - start;
  const elapsedMs = Math.min(now - start, totalMs);
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((elapsedMs / totalMs) * 100))
  );
  const daysRemaining = Math.max(
    0,
    Math.ceil((maturity - now) / (1000 * 60 * 60 * 24))
  );
  const accruedValueKobo = Math.round(
    inv.principalKobo +
      (inv.interestKobo * elapsedMs) / totalMs
  );
  const isMatured = now >= maturity;

  return {
    ...inv,
    progressPercent,
    daysRemaining,
    accruedValueKobo,
    isMatured,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class InvestmentService {
  private readonly col = adminDb.collection("investments");
  private readonly walletsCol = adminDb.collection("wallets");

  // ─── Create investment ──────────────────────────────────────────────────────

  async createInvestment(
    userId: string,
    packageId: string,
    principalKobo: number
  ): Promise<Investment> {
    const pkg = INVESTMENT_PACKAGES.find((p) => p.id === packageId);
    if (!pkg || !pkg.isActive) {
      throw new InvestmentError(
        "PACKAGE_NOT_FOUND",
        "Investment package not found or no longer available."
      );
    }

    if (principalKobo < pkg.minAmountKobo) {
      throw new InvestmentError(
        "BELOW_MINIMUM",
        `Minimum investment for this package is ₦${pkg.minAmountKobo / 100}.`
      );
    }

    if (principalKobo > pkg.maxAmountKobo) {
      throw new InvestmentError(
        "ABOVE_MAXIMUM",
        `Maximum investment for this package is ₦${pkg.maxAmountKobo / 100}.`
      );
    }

    // Check wallet
    const walletSnap = await this.walletsCol.doc(userId).get();
    if (!walletSnap.exists) {
      throw new InvestmentError("NOT_FOUND", "Wallet not found.");
    }
    const wallet = walletSnap.data()!;
    if (wallet.available < principalKobo) {
      throw new InvestmentError(
        "INSUFFICIENT_FUNDS",
        `Insufficient balance. Available: ₦${wallet.available / 100}.`
      );
    }

    const { interestKobo, expectedReturnKobo } = calcExpectedReturn(
      principalKobo,
      pkg.annualYieldPercent,
      pkg.durationDays
    );

    const startDate = Timestamp.now();
    const maturityMs =
      startDate.toMillis() + pkg.durationDays * 24 * 60 * 60 * 1000;
    const maturityDate = Timestamp.fromMillis(maturityMs);

    return adminDb.runTransaction(async (tx) => {
      const txId = await debitWallet(
        tx,
        userId,
        principalKobo,
        "contribution", // closest existing type — investment_deposit would be ideal
        `Investment in ${pkg.name} — ${pkg.durationDays} days @ ${pkg.annualYieldPercent}% p.a.`,
        {}
      );

      const invRef = this.col.doc();
      const inv: Omit<Investment, "id"> = {
        userId,
        packageId,
        packageName: pkg.name,
        packageCategory: pkg.category,
        principalKobo,
        annualYieldPercent: pkg.annualYieldPercent,
        durationDays: pkg.durationDays,
        expectedReturnKobo,
        interestKobo,
        status: "active",
        startDate,
        maturityDate,
        transactionId: txId,
        riskLevel: pkg.riskLevel,
        createdAt: FieldValue.serverTimestamp() as any,
        updatedAt: FieldValue.serverTimestamp() as any,
      };
      tx.set(invRef, inv);

      return { id: invRef.id, ...inv } as Investment;
    });
  }

  // ─── Withdraw (after maturity) ──────────────────────────────────────────────

  async withdrawInvestment(
    userId: string,
    investmentId: string
  ): Promise<{ netReturnKobo: number; feePaidKobo: number }> {
    const invSnap = await this.col.doc(investmentId).get();
    if (!invSnap.exists) {
      throw new InvestmentError("NOT_FOUND", "Investment not found.");
    }

    const inv = { id: invSnap.id, ...invSnap.data() } as Investment;

    if (inv.userId !== userId) {
      throw new InvestmentError(
        "UNAUTHORIZED",
        "This investment does not belong to you."
      );
    }

    if (inv.status !== "active") {
      throw new InvestmentError(
        "INVALID_STATUS",
        `Cannot withdraw an investment with status "${inv.status}".`
      );
    }

    const investmentSettings = await getInvestmentSettings();

    const now = Timestamp.now();
    if (now.toMillis() < inv.maturityDate.toMillis()) {
      if (!investmentSettings.earlyWithdrawalEnabled) {
        const daysLeft = Math.ceil(
          (inv.maturityDate.toMillis() - now.toMillis()) / (1000 * 60 * 60 * 24)
        );
        throw new InvestmentError(
          "NOT_MATURED",
          `Investment matures in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Early withdrawal is not permitted.`
        );
      }
    }

    const platformFeeKobo = Math.round(
      inv.interestKobo * (investmentSettings.platformInterestFeePercent / 100)
    );
    const netReturnKobo = inv.expectedReturnKobo - platformFeeKobo;

    await adminDb.runTransaction(async (tx) => {
      await creditWallet(
        tx,
        userId,
        netReturnKobo,
        "payout",
        `Investment maturity payout: ${inv.packageName} (${inv.durationDays}-day term)`,
        {}
      );

      tx.update(this.col.doc(investmentId), {
        status: "withdrawn",
        withdrawnAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    void sendNotification(userId, {
      type: "payout_received",
      title: "Investment Matured! 🎉",
      body: `Your ${inv.packageName} investment has been paid out. ₦${netReturnKobo / 100} credited to your wallet.`,
      link: "/investments",
    });

    return { netReturnKobo, feePaidKobo: platformFeeKobo };
  }

  // ─── List user investments ──────────────────────────────────────────────────

  async getUserInvestments(userId: string): Promise<Investment[]> {
    const snap = await this.col
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Investment));
  }

  // ─── Portfolio summary ──────────────────────────────────────────────────────

  async getPortfolioSummary(
    userId: string
  ): Promise<InvestmentPortfolioSummary> {
    const investments = await this.getUserInvestments(userId);

    let totalInvestedKobo = 0;
    let totalExpectedReturnKobo = 0;
    let totalInterestEarnedKobo = 0;
    let totalAccruedKobo = 0;
    let activeCount = 0;
    let maturedCount = 0;
    let withdrawnCount = 0;
    let yieldSum = 0;

    const now = Date.now();

    for (const inv of investments) {
      if (inv.status === "active") {
        activeCount++;
        totalInvestedKobo += inv.principalKobo;
        totalExpectedReturnKobo += inv.expectedReturnKobo;
        yieldSum += inv.annualYieldPercent;

        const start = inv.startDate.toMillis();
        const maturity = inv.maturityDate.toMillis();
        const elapsed = Math.min(now - start, maturity - start);
        const accrued = Math.round(
          inv.principalKobo + (inv.interestKobo * elapsed) / (maturity - start)
        );
        totalAccruedKobo += accrued;
      } else if (inv.status === "matured") {
        maturedCount++;
      } else if (inv.status === "withdrawn") {
        withdrawnCount++;
        totalInterestEarnedKobo += inv.interestKobo;
      }
    }

    return {
      totalInvestedKobo,
      totalExpectedReturnKobo,
      totalInterestEarnedKobo,
      totalAccruedKobo,
      activeCount,
      maturedCount,
      withdrawnCount,
      averageYieldPercent:
        activeCount > 0 ? Math.round((yieldSum / activeCount) * 10) / 10 : 0,
    };
  }
}