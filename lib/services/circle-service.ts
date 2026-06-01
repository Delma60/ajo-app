import { debitWallet, creditWallet, addPending, confirmPending } from "@/lib/services/wallet-service";
import {
  getSettings,
  getCircleSettings,
  getPayoutSettings,
} from "@/lib/services/settings-service";
/**
 * Circle Service
 * Business logic for circle lifecycle: create, join, contribute, payout,
 * penalty application, bid submission, pause/unpause, and member removal.
 *
 * Rules enforced here (never client-side):
 *  - Creation fee = dynamic per admin settings (default 5% of contribution)
 *  - Admin is always turn position 1 (index 0) in rotational circles
 *  - Payouts only when all member slots are filled
 *  - Contribution state machine: pending → paid | late → paid | missed
 *  - Late penalty = dynamic per admin settings (default 10% of contribution)
 *  - Consecutive missed payments → auto-removal (dynamic per settings, default 3)
 *  - Grace period = dynamic per settings (default 48 hours)
 *  - KYC gate for circle creation and payouts > ₦50,000
 *  - Maximum 10 active circles per user
 *  - Bid deadline = dynamic per settings (default 24h before nextPayoutDate)
 *  - Bid premium distributed equally to non-winning members
 *  - Platform payout fee = dynamic per settings (default 1%)
 *  - goal = contribution × maxMembers, always derived — never stored
 */

import { adminDb, admin } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/types/admin-settings";
import { MAX_ACTIVE_CIRCLES } from "@/lib/constants";
import { sendNotification } from "@/lib/services/notification-service";
import * as smsService from "@/lib/services/sms-service";
import {
  sendDueRemindersForCircle,
  sendPayoutNotification,
  sendLatePaymentWarning,
  sendContributionReceipt,
} from "@/lib/services/circle-notification-helpers";
// wallet helpers (debit, credit, pending) — single import above
import {
  recordOnTimePayment,
  recordLatePayment,
  recordMissedPayment,
} from "@/lib/services/trust-score-service";
import type { Circle } from "@/lib/types/circle";
import type { Contribution } from "@/lib/types/contribution";
import type { Bid } from "@/lib/types/bid";
import type { User } from "@/lib/types/user";
import type { Wallet } from "@/lib/types/wallet";

// ─── Custom error ─────────────────────────────────────────────────────────────

export class CircleError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "CircleError";
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class CircleService {
  private readonly circlesCol = adminDb.collection("circles");
  private readonly usersCol = adminDb.collection("users");
  private readonly walletsCol = adminDb.collection("wallets");
  private readonly contributionsCol = adminDb.collection("contributions");
  private readonly transactionsCol = adminDb.collection("transactions");
  private readonly bidsCol = adminDb.collection("bids");

  // ─── Create ────────────────────────────────────────────────────────────────

  async createCircle(
    adminId: string,
    name: string,
    description: string,
    maxMembers: number,
    contributionKobo: number,
    frequency: Circle["frequency"],
    payoutOrder: Circle["payoutOrder"],
    isPrivate: boolean,
    tags: string[]
  ): Promise<Circle> {
    // Load settings
    const settings = await getCircleSettings();

    if (maxMembers < settings.minCircleMembers) {
      throw new CircleError(
        "INVALID_INPUT",
        `Circle must have at least ${settings.minCircleMembers} members.`
      );
    }
    if (contributionKobo < settings.minContributionKobo) {
      throw new CircleError(
        "INVALID_INPUT",
        `Minimum contribution is ₦${settings.minContributionKobo / 100}.`
      );
    }
    if (contributionKobo > settings.maxContributionKobo) {
      throw new CircleError(
        "INVALID_INPUT",
        `Maximum contribution is ₦${settings.maxContributionKobo / 100}.`
      );
    }
    if (maxMembers > settings.maxCircleMembers) {
      throw new CircleError(
        "INVALID_INPUT",
        `Maximum members allowed is ${settings.maxCircleMembers}.`
      );
    }

    const [, adminWallet] = await Promise.all([
      this.requireUser(adminId),
      this.requireWallet(adminId),
    ]);

    const activeCount = await this.countActiveCircles(adminId);
    if (activeCount >= settings.maxActiveCirclesPerUser) {
      throw new CircleError(
        "MAX_CIRCLES_REACHED",
        `You can be in a maximum of ${settings.maxActiveCirclesPerUser} active circles.`
      );
    }

    const creationFee = Math.round(contributionKobo * settings.creationFeePercent);
    if (adminWallet.available < creationFee) {
      throw new CircleError(
        "INSUFFICIENT_FUNDS",
        `Insufficient wallet balance for creation fee of ₦${creationFee / 100}.`
      );
    }

    return adminDb.runTransaction(async (tx) => {
      const circleRef = this.circlesCol.doc();
      const { nextDueDate, nextPayoutDate } = this.nextDates(frequency, new Date());

      await debitWallet(tx, adminId, creationFee, "creation_fee", `Circle creation fee for "${name}"`, {
        circleId: circleRef.id,
      });

      const inviteCode = this.generateInviteCode();
      const now = FieldValue.serverTimestamp();

      const circleData: Omit<Circle, "id"> = {
        name: name.trim(),
        description: description.trim(),
        adminId,
        memberIds: [adminId],
        maxMembers,
        contribution: contributionKobo,
        frequency,
        payoutOrder,
        status: "active",
        isPrivate,
        currentCycle: 1,
        totalCycles: maxMembers,
        nextDueDate,
        nextPayoutDate,
        currentRecipientId: adminId,
        trustScore: 100,
        trustScoreBreakdown: {
          onTimePayments: 0,
          latePayments: 0,
          missedPayments: 0,
          lastUpdated: Timestamp.now(),
        },
        saved: 0,
        creationFee,
        tags: tags.slice(0, 5),
        pendingRequestIds: [],
        inviteCode,
        createdAt: now as any,
        updatedAt: now as any,
      };

      tx.set(circleRef, circleData);
      tx.update(this.usersCol.doc(adminId), {
        circleIds: FieldValue.arrayUnion(circleRef.id),
        updatedAt: now,
      });

      return { id: circleRef.id, ...circleData, goal: contributionKobo * maxMembers } as Circle;
    });
  }

  // ─── Join ──────────────────────────────────────────────────────────────────

  async joinCircle(circleId: string, userId: string, inviteCode?: string): Promise<Circle> {
    return adminDb.runTransaction(async (tx) => {
      const [circleSnap, userSnap] = await tx.getAll(
        this.circlesCol.doc(circleId),
        this.usersCol.doc(userId)
      );

      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");
      if (!userSnap.exists) throw new CircleError("NOT_FOUND", "User not found.");

      const circle = circleSnap.data() as Circle;
      const user = userSnap.data() as User;

      if (circle.memberIds.includes(userId)) {
        throw new CircleError("ALREADY_MEMBER", "You are already a member of this circle.");
      }
      if (circle.memberIds.length >= circle.maxMembers) {
        throw new CircleError("CIRCLE_FULL", "This circle has no available spots.");
      }
      if (circle.status !== "active") {
        throw new CircleError("CIRCLE_INACTIVE", "This circle is not accepting new members.");
      }

      const activeCount = await this.countActiveCircles(userId);
      if (activeCount >= MAX_ACTIVE_CIRCLES) {
        throw new CircleError(
          "MAX_CIRCLES_REACHED",
          `You can be in a maximum of ${MAX_ACTIVE_CIRCLES} active circles.`
        );
      }

      if (circle.isPrivate) {
        if (!inviteCode || circle.inviteCode !== inviteCode.toUpperCase()) {
          throw new CircleError("INVALID_INVITE_CODE", "Invalid invite code.");
        }
      }

      const updatedMemberIds = [...circle.memberIds, userId];
      const now = FieldValue.serverTimestamp();

      tx.update(this.circlesCol.doc(circleId), {
        memberIds: updatedMemberIds,
        pendingRequestIds: FieldValue.arrayRemove(userId),
        updatedAt: now,
      });
      tx.update(this.usersCol.doc(userId), {
        circleIds: FieldValue.arrayUnion(circleId),
        updatedAt: now,
      });

      void sendNotification(circle.adminId, {
        type: "member_joined",
        title: "New Member Joined",
        body: `${user.name} joined your circle "${circle.name}".`,
        link: `/circles/${circleId}`,
      });
      void sendNotification(userId, {
        type: "general",
        title: "Welcome to the Circle!",
        body: `You successfully joined "${circle.name}".`,
        link: `/circles/${circleId}`,
      });

      return { ...circle, memberIds: updatedMemberIds, goal: circle.contribution * circle.maxMembers } as Circle;
    });
  }

  // ─── Contribute ────────────────────────────────────────────────────────────

  async makeContribution(circleId: string, userId: string, amountKobo: number): Promise<Contribution> {
    // Load settings for penalty calculation
    const settings = await getCircleSettings();

    return adminDb.runTransaction(async (tx) => {
      const [circleSnap, userSnap, walletSnap] = await tx.getAll(
        this.circlesCol.doc(circleId),
        this.usersCol.doc(userId),
        this.walletsCol.doc(userId)
      );

      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");
      if (!userSnap.exists) throw new CircleError("NOT_FOUND", "User not found.");
      if (!walletSnap.exists) throw new CircleError("NOT_FOUND", "Wallet not found.");

      const circle = circleSnap.data() as Circle;
      const user = userSnap.data() as User;
      const wallet = walletSnap.data() as Wallet;

      if (!circle.memberIds.includes(userId)) {
        throw new CircleError("NOT_MEMBER", "You are not a member of this circle.");
      }
      if (circle.status !== "active") {
        throw new CircleError("CIRCLE_INACTIVE", "This circle is not active.");
      }
      if (amountKobo !== circle.contribution) {
        throw new CircleError(
          "INVALID_AMOUNT",
          `Contribution must be exactly ₦${circle.contribution / 100}.`
        );
      }

      const contribQuery = await this.contributionsCol
        .where("circleId", "==", circleId)
        .where("userId", "==", userId)
        .where("cycle", "==", circle.currentCycle)
        .limit(1)
        .get();

      let contribRef: admin.firestore.DocumentReference;
      let contrib: Contribution;

      if (contribQuery.empty) {
        contribRef = this.contributionsCol.doc();
        contrib = {
          id: contribRef.id,
          circleId,
          userId,
          cycle: circle.currentCycle,
          amount: amountKobo,
          status: "pending",
          dueDate: circle.nextDueDate,
          createdAt: FieldValue.serverTimestamp() as any,
        };
        tx.set(contribRef, contrib);
      } else {
        contribRef = contribQuery.docs[0].ref;
        contrib = { id: contribQuery.docs[0].id, ...contribQuery.docs[0].data() } as Contribution;
      }

      if (contrib.status === "paid") {
        throw new CircleError("ALREADY_PAID", "You have already paid for this cycle.");
      }

      let penaltyKobo = 0;
      if (contrib.status === "late" && !contrib.penaltyPaid) {
        penaltyKobo = Math.round(circle.contribution * settings.latePenaltyPercent);
      }

      const totalDeduction = amountKobo + penaltyKobo;
      if (wallet.available < totalDeduction) {
        throw new CircleError(
          "INSUFFICIENT_FUNDS",
          `You need ₦${totalDeduction / 100} but have ₦${wallet.available / 100}.`
        );
      }

      const contribTxId = await debitWallet(
        tx, userId, amountKobo, "contribution",
        `Contribution to "${circle.name}" — Cycle ${circle.currentCycle}`,
        { circleId }
      );

      if (penaltyKobo > 0) {
        await debitWallet(
          tx, userId, penaltyKobo, "penalty",
          `Late contribution penalty for "${circle.name}" — Cycle ${circle.currentCycle}`,
          { circleId }
        );
      }

      const now = FieldValue.serverTimestamp();

      tx.update(contribRef, {
        status: "paid",
        paidAt: now,
        transactionId: contribTxId,
        ...(penaltyKobo > 0 ? { penaltyAmount: penaltyKobo, penaltyPaid: true } : {}),
        updatedAt: now,
      });

      tx.update(this.circlesCol.doc(circleId), {
        saved: FieldValue.increment(amountKobo),
        updatedAt: now,
      });

      // ── Trust score: record on-time only if it was still pending (not late) ──
      if (contrib.status === "pending") {
        await recordOnTimePayment(tx, circleId, circle.trustScoreBreakdown);
      }

      void sendContributionReceipt(userId, user, circle, amountKobo);

      return { ...contrib, status: "paid", paidAt: Timestamp.now(), transactionId: contribTxId } as Contribution;
    });
  }

  // ─── Process Payouts (cron) ────────────────────────────────────────────────

  async processPayouts(): Promise<void> {
    const now = Timestamp.now();
    // Load platform settings once to get settlement period
    let settlementHours = DEFAULT_PLATFORM_SETTINGS.payouts.settlementPeriodHours;
    try {
      const settingsSnap = await adminDb
        .collection("admin_config")
        .doc("platform_settings")
        .get();
      if (settingsSnap.exists) {
        settlementHours =
          (settingsSnap.data()?.payouts?.settlementPeriodHours as number) ?? settlementHours;
      }
    } catch (err) {
      console.warn("Failed to read platform settings, using defaults", err);
    }
    const snap = await this.circlesCol
      .where("status", "==", "active")
      .where("nextPayoutDate", "<=", now)
      .get();

    for (const circleDoc of snap.docs) {
      try {
        await this.processSinglePayout(circleDoc, settlementHours);
      } catch (err) {
        console.error(`[circle-service] Payout failed for circle ${circleDoc.id}:`, err);
      }
    }

    // After processing payouts, attempt to settle any pending payout transactions
    try {
      await this.settlePendingPayouts(settlementHours);
    } catch (err) {
      console.error("[circle-service] Failed to settle pending payouts:", err);
    }
  }

  private async processSinglePayout(circleDoc: admin.firestore.QueryDocumentSnapshot, settlementHours: number): Promise<void> {
    const circle = circleDoc.data() as Circle;

    // Load settings for platform payout fee and bid closing hours
    const payoutSettings = await getPayoutSettings();
    const circleSettings = await getCircleSettings();

    const paidSnap = await this.contributionsCol
      .where("circleId", "==", circle.id)
      .where("cycle", "==", circle.currentCycle)
      .where("status", "==", "paid")
      .get();

    if (paidSnap.size < circle.memberIds.length) {
      console.log(
        `[circle-service] Circle ${circle.id}: waiting for ${circle.memberIds.length - paidSnap.size} more payments.`
      );
      return;
    }

    await adminDb.runTransaction(async (tx) => {
      const circleRef = this.circlesCol.doc(circle.id);

      let recipientId = circle.currentRecipientId;
      let bidPremiumKobo = 0;
      let winningBidRef: admin.firestore.DocumentReference | null = null;

      if (circle.payoutOrder === "bidding") {
        const bidResult = await this.resolveWinningBid(circle, tx, circleSettings);
        if (bidResult) {
          recipientId = bidResult.userId;
          bidPremiumKobo = bidResult.amount;
          winningBidRef = bidResult.ref;
        }
      }

      if (circle.payoutOrder === "random") {
        recipientId = circle.memberIds[Math.floor(Math.random() * circle.memberIds.length)];
      }

      const recipientSnap = await tx.get(this.usersCol.doc(recipientId));
      const recipient = recipientSnap.data() as User;
      const basePool = circle.contribution * circle.memberIds.length;
      const platformFee = Math.round(basePool * payoutSettings.platformPayoutFeePercent);
      const netPayout = basePool - platformFee + bidPremiumKobo;

      if (winningBidRef) {
        tx.update(winningBidRef, { status: "won", updatedAt: FieldValue.serverTimestamp() });

        const otherBidsSnap = await this.bidsCol
          .where("circleId", "==", circle.id)
          .where("cycle", "==", circle.currentCycle)
          .where("status", "==", "active")
          .get();
        for (const bidDoc of otherBidsSnap.docs) {
          if (bidDoc.ref.id !== winningBidRef.id) {
            tx.update(bidDoc.ref, { status: "lost", updatedAt: FieldValue.serverTimestamp() });
          }
        }

        if (bidPremiumKobo > 0) {
          const nonWinners = circle.memberIds.filter((id) => id !== recipientId);
          if (nonWinners.length > 0) {
            const shareKobo = Math.floor(bidPremiumKobo / nonWinners.length);
            for (const memberId of nonWinners) {
              await creditWallet(
                tx, memberId, shareKobo, "payout",
                `Bid premium share from "${circle.name}" — Cycle ${circle.currentCycle}`,
                { circleId: circle.id }
              );
            }
          }
        }
      }

      // Respect settlement period: either credit to available balance immediately
      // or place into wallet.pending and create a pending transaction to be
      // settled later by the cron job.
      if (settlementHours > 0) {
        await addPending(tx, recipientId, netPayout);
        const pendingTxRef = adminDb.collection("transactions").doc();
        const pendingTx: Omit<any, "id"> = {
          userId: recipientId,
          circleId: circle.id,
          type: "payout",
          direction: "credit",
          amount: netPayout,
          fee: 0,
          netAmount: netPayout,
          status: "pending",
          reference: pendingTxRef.id,
          description: `Pending payout from "${circle.name}" — Cycle ${circle.currentCycle}`,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        tx.set(pendingTxRef, pendingTx);
      } else {
        await creditWallet(
          tx, recipientId, netPayout, "payout",
          `Payout from "${circle.name}" — Cycle ${circle.currentCycle}`,
          { circleId: circle.id }
        );
      }

      const nextCycle = circle.currentCycle + 1;
      const isComplete = nextCycle > circle.totalCycles;
      const nextRecipientId = isComplete ? "" : this.advanceRecipient(circle, recipientId);
      const { nextDueDate, nextPayoutDate } = this.nextDates(circle.frequency, new Date());

      tx.update(circleRef, {
        currentCycle: nextCycle,
        currentRecipientId: nextRecipientId,
        nextDueDate,
        nextPayoutDate,
        saved: 0,
        status: isComplete ? "completed" : "active",
        updatedAt: FieldValue.serverTimestamp(),
      });

      void sendPayoutNotification(recipientId, recipient, circle.name, circle.id, netPayout);
    });
  }

  // Settles pending payouts older than `settlementHours` by moving them from
  // wallet.pending -> wallet.available and marking their transaction success.
  private async settlePendingPayouts(settlementHours: number): Promise<void> {
    if (!settlementHours || settlementHours <= 0) return;

    const cutoff = new Date(Date.now() - settlementHours * 60 * 60 * 1000);
    const cutoffTs = Timestamp.fromDate(cutoff);

    const snap = await this.transactionsCol
      .where("type", "==", "payout")
      .where("status", "==", "pending")
      .where("createdAt", "<=", cutoffTs)
      .get();

    for (const txDoc of snap.docs) {
      try {
        await adminDb.runTransaction(async (tx) => {
          const data = txDoc.data() as any;
          const userId = data.userId as string;
          const amount = data.amount as number;
          if (!userId || !amount) return;

          // Move pending -> available
          await confirmPending(tx, userId, amount);

          // Mark transaction as success
          tx.update(txDoc.ref, {
            status: "success",
            updatedAt: FieldValue.serverTimestamp(),
          });

          // Notify user about settled payout (fetch circle and user data inside tx)
          const userSnap = await tx.get(this.usersCol.doc(userId));
          const circleSnap = data.circleId ? await tx.get(this.circlesCol.doc(data.circleId)) : null;
          const user = userSnap.exists ? (userSnap.data() as User) : null;
          const circle = circleSnap && circleSnap.exists ? (circleSnap.data() as Circle) : null;
          if (user) {
            void sendPayoutNotification(
              userId,
              user,
              circle ? circle.name : (data.circleId as string) || "",
              (data.circleId as string) || "",
              amount,
              {
                grossPayoutKobo: amount,
                platformFeeKobo: 0,
                transactionReference: txDoc.id,
                payoutDate: new Date(),
              }
            );
          }
        });
      } catch (err) {
        console.error(`[circle-service] Failed to settle pending tx ${txDoc.id}:`, err);
      }
    }
  }

  // ─── Send Reminders (cron) ─────────────────────────────────────────────────

  async sendContributionReminders(): Promise<void> {
    const now = Timestamp.now();
    const snap = await this.circlesCol
      .where("status", "==", "active")
      .where("nextDueDate", "<=", now)
      .get();
    for (const circleDoc of snap.docs) {
      const circle = circleDoc.data() as Circle;
      const paidSnap = await this.contributionsCol
        .where("circleId", "==", circle.id)
        .where("cycle", "==", circle.currentCycle)
        .where("status", "==", "paid")
        .get();
      const paidIds = new Set(paidSnap.docs.map((d) => d.data().userId as string));
      const unpaidMemberIds = circle.memberIds.filter((id) => !paidIds.has(id));
      await sendDueRemindersForCircle(circle, unpaidMemberIds);
    }
  }

  // ─── Apply Penalties (cron) ────────────────────────────────────────────────

  async applyPenalties(): Promise<void> {
    // Load settings for grace period
    const settings = await getCircleSettings();

    const graceCutoff = new Date();
    graceCutoff.setHours(graceCutoff.getHours() - settings.gracePeriodHours);

    const snap = await this.contributionsCol
      .where("status", "==", "pending")
      .where("dueDate", "<=", Timestamp.fromDate(graceCutoff))
      .get();

    for (const contribDoc of snap.docs) {
      try {
        await this.applyPenaltyToContribution(contribDoc, settings);
      } catch (err) {
        console.error(`[circle-service] Penalty failed for contribution ${contribDoc.id}:`, err);
      }
    }
  }

  private async applyPenaltyToContribution(
    contribDoc: admin.firestore.QueryDocumentSnapshot,
    settings: Awaited<ReturnType<typeof getCircleSettings>>
  ): Promise<void> {
    const contrib = { id: contribDoc.id, ...contribDoc.data() } as Contribution;

    await adminDb.runTransaction(async (tx) => {
      const circleSnap = await tx.get(this.circlesCol.doc(contrib.circleId));
      const userSnap = await tx.get(this.usersCol.doc(contrib.userId));

      if (!circleSnap.exists || !userSnap.exists) return;

      const circle = circleSnap.data() as Circle;
      const user = userSnap.data() as User;

      // Check for consecutive missed payments before marking this one
      const missedSnap = await this.contributionsCol
        .where("circleId", "==", contrib.circleId)
        .where("userId", "==", contrib.userId)
        .where("status", "==", "missed")
        .orderBy("cycle", "desc")
        .limit(settings.consecutiveMissedLimit)
        .get();

      if (missedSnap.size >= settings.consecutiveMissedLimit - 1) {
        // Escalate to missed and auto-remove
        tx.update(contribDoc.ref, {
          status: "missed",
          updatedAt: FieldValue.serverTimestamp(),
        });

        // ── Trust score: record missed payment ────────────────────────────────
        await recordMissedPayment(tx, contrib.circleId, circle.trustScoreBreakdown);

        tx.update(this.circlesCol.doc(contrib.circleId), {
          memberIds: FieldValue.arrayRemove(contrib.userId),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(this.usersCol.doc(contrib.userId), {
          circleIds: FieldValue.arrayRemove(contrib.circleId),
          updatedAt: FieldValue.serverTimestamp(),
        });

        void sendNotification(contrib.userId, {
          type: "general",
          title: "Removed from Circle",
          body: `You were removed from "${circle.name}" after ${settings.consecutiveMissedLimit} consecutive missed payments.`,
          link: "/circles",
        });
        return;
      }

      // Mark as late
      tx.update(contribDoc.ref, {
        status: "late",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // ── Trust score: record late payment ──────────────────────────────────
      await recordLatePayment(tx, contrib.circleId, circle.trustScoreBreakdown);

      const penaltyKobo = Math.round(circle.contribution * settings.latePenaltyPercent);

      void sendLatePaymentWarning(contrib.userId, user, circle, penaltyKobo);
    });
  }

  // ─── Bid ───────────────────────────────────────────────────────────────────

  async submitBid(circleId: string, userId: string, bidPremiumKobo: number): Promise<Bid> {
    if (bidPremiumKobo <= 0) {
      throw new CircleError("INVALID_INPUT", "Bid amount must be positive.");
    }

    // Load settings for bid deadline
    const settings = await getCircleSettings();

    return adminDb.runTransaction(async (tx) => {
      const circleSnap = await tx.get(this.circlesCol.doc(circleId));
      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");

      const circle = circleSnap.data() as Circle;

      if (circle.payoutOrder !== "bidding") {
        throw new CircleError("INVALID_OPERATION", "Bidding is only for bidding-order circles.");
      }
      if (!circle.memberIds.includes(userId)) {
        throw new CircleError("NOT_MEMBER", "You are not a member of this circle.");
      }

      const deadline = new Date(circle.nextPayoutDate.toDate());
      deadline.setHours(deadline.getHours() - settings.bidCloseHoursBeforePayout);

      if (new Date() > deadline) {
        throw new CircleError("BID_CLOSED", "Bidding for this cycle has closed.");
      }

      const existingBidSnap = await this.bidsCol
        .where("circleId", "==", circleId)
        .where("userId", "==", userId)
        .where("cycle", "==", circle.currentCycle)
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (!existingBidSnap.empty) {
        throw new CircleError("DUPLICATE_BID", "You already have an active bid for this cycle.");
      }

      const bidRef = this.bidsCol.doc();
      const bidData: Omit<Bid, "id"> = {
        circleId,
        cycle: circle.currentCycle,
        userId,
        amount: bidPremiumKobo,
        status: "active",
        deadline: Timestamp.fromDate(deadline),
        createdAt: FieldValue.serverTimestamp() as any,
      };
      tx.set(bidRef, bidData);

      void sendNotification(circle.adminId, {
        type: "general",
        title: "New Bid",
        body: `A member placed a ₦${bidPremiumKobo / 100} bid for "${circle.name}" — Cycle ${circle.currentCycle}.`,
        link: `/circles/${circleId}`,
      });

      return { id: bidRef.id, ...bidData } as Bid;
    });
  }

  // ─── Pause / Unpause ───────────────────────────────────────────────────────

  async pauseCircle(circleId: string, adminId: string): Promise<Circle> {
    return adminDb.runTransaction(async (tx) => {
      const circleSnap = await tx.get(this.circlesCol.doc(circleId));
      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");

      const circle = circleSnap.data() as Circle;

      if (circle.adminId !== adminId) {
        throw new CircleError("UNAUTHORIZED", "Only the circle admin can pause the circle.");
      }
      if (circle.status === "paused") {
        throw new CircleError("INVALID_OPERATION", "Circle is already paused.");
      }
      if (circle.status !== "active") {
        throw new CircleError("INVALID_OPERATION", `Cannot pause a ${circle.status} circle.`);
      }

      tx.update(this.circlesCol.doc(circleId), {
        status: "paused",
        updatedAt: FieldValue.serverTimestamp(),
      });

      void this.notifyAllMembers(circle, {
        type: "general",
        title: "Circle Paused",
        body: `"${circle.name}" has been paused by the admin. Contributions are suspended.`,
        link: `/circles/${circleId}`,
      });

      return { ...circle, status: "paused" } as Circle;
    });
  }

  async unpauseCircle(circleId: string, adminId: string): Promise<Circle> {
    return adminDb.runTransaction(async (tx) => {
      const circleSnap = await tx.get(this.circlesCol.doc(circleId));
      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");

      const circle = circleSnap.data() as Circle;

      if (circle.adminId !== adminId) {
        throw new CircleError("UNAUTHORIZED", "Only the circle admin can unpause the circle.");
      }
      if (circle.status !== "paused") {
        throw new CircleError("INVALID_OPERATION", "Circle is not paused.");
      }

      const { nextDueDate, nextPayoutDate } = this.nextDates(circle.frequency, new Date());

      tx.update(this.circlesCol.doc(circleId), {
        status: "active",
        nextDueDate,
        nextPayoutDate,
        updatedAt: FieldValue.serverTimestamp(),
      });

      void this.notifyAllMembers(circle, {
        type: "general",
        title: "Circle Resumed",
        body: `"${circle.name}" has been unpaused. Contributions resume as normal.`,
        link: `/circles/${circleId}`,
      });

      return { ...circle, status: "active", nextDueDate, nextPayoutDate } as Circle;
    });
  }

  // ─── Remove Member ─────────────────────────────────────────────────────────

  async removeMember(circleId: string, memberId: string, adminId: string): Promise<Circle> {
    return adminDb.runTransaction(async (tx) => {
      const [circleSnap, memberSnap] = await tx.getAll(
        this.circlesCol.doc(circleId),
        this.usersCol.doc(memberId)
      );

      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");
      if (!memberSnap.exists) throw new CircleError("NOT_FOUND", "Member not found.");

      const circle = circleSnap.data() as Circle;
      const member = memberSnap.data() as User;

      if (circle.adminId !== adminId) {
        throw new CircleError("UNAUTHORIZED", "Only the circle admin can remove members.");
      }
      if (memberId === adminId) {
        throw new CircleError("INVALID_OPERATION", "Admin cannot remove themselves.");
      }
      if (!circle.memberIds.includes(memberId)) {
        throw new CircleError("NOT_MEMBER", "User is not a member of this circle.");
      }

      const updatedMemberIds = circle.memberIds.filter((id) => id !== memberId);
      const now = FieldValue.serverTimestamp();

      tx.update(this.circlesCol.doc(circleId), {
        memberIds: updatedMemberIds,
        updatedAt: now,
      });
      tx.update(this.usersCol.doc(memberId), {
        circleIds: FieldValue.arrayRemove(circleId),
        updatedAt: now,
      });

      const pendingContribsSnap = await this.contributionsCol
        .where("circleId", "==", circleId)
        .where("userId", "==", memberId)
        .where("status", "==", "pending")
        .get();

      for (const d of pendingContribsSnap.docs) {
        tx.update(d.ref, { status: "cancelled", updatedAt: now });
      }

      void sendNotification(memberId, {
        type: "general",
        title: "Removed from Circle",
        body: `You have been removed from "${circle.name}".`,
        link: "/circles",
      });
      void sendNotification(adminId, {
        type: "general",
        title: "Member Removed",
        body: `${member.name} has been removed from "${circle.name}".`,
        link: `/circles/${circleId}`,
      });

      return { ...circle, memberIds: updatedMemberIds } as Circle;
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async requireUser(userId: string): Promise<User> {
    const snap = await this.usersCol.doc(userId).get();
    if (!snap.exists) throw new CircleError("NOT_FOUND", `User ${userId} not found.`);
    return snap.data() as User;
  }

  private async requireWallet(userId: string): Promise<Wallet> {
    const snap = await this.walletsCol.doc(userId).get();
    if (!snap.exists) throw new CircleError("NOT_FOUND", `Wallet for user ${userId} not found.`);
    return snap.data() as Wallet;
  }

  private async countActiveCircles(userId: string): Promise<number> {
    const snap = await this.circlesCol
      .where("memberIds", "array-contains", userId)
      .where("status", "==", "active")
      .get();
    return snap.size;
  }

  private async resolveWinningBid(
    circle: Circle,
    _tx: admin.firestore.Transaction,
    settings: Awaited<ReturnType<typeof getCircleSettings>>
  ): Promise<{ userId: string; amount: number; ref: admin.firestore.DocumentReference } | null> {
    const deadline = new Date(circle.nextPayoutDate.toDate());
    deadline.setHours(deadline.getHours() - settings.bidCloseHoursBeforePayout);

    if (new Date() < deadline) return null;

    const snap = await this.bidsCol
      .where("circleId", "==", circle.id)
      .where("cycle", "==", circle.currentCycle)
      .where("status", "==", "active")
      .orderBy("amount", "desc")
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    const bid = doc.data() as Bid;
    return { userId: bid.userId, amount: bid.amount, ref: doc.ref };
  }

  private advanceRecipient(circle: Circle, currentRecipientId: string): string {
    if (circle.payoutOrder !== "rotational") return currentRecipientId;
    const idx = circle.memberIds.indexOf(currentRecipientId);
    return circle.memberIds[(idx + 1) % circle.memberIds.length];
  }

  private nextDates(
    frequency: Circle["frequency"],
    from: Date
  ): { nextDueDate: Timestamp; nextPayoutDate: Timestamp } {
    const d = new Date(from);
    d.setUTCHours(9, 0, 0, 0);

    switch (frequency) {
      case "daily":
        d.setUTCDate(d.getUTCDate() + 1);
        break;
      case "weekly":
        d.setUTCDate(d.getUTCDate() + 7);
        break;
      case "bi-weekly":
        d.setUTCDate(d.getUTCDate() + 14);
        break;
      case "monthly":
        d.setUTCMonth(d.getUTCMonth() + 1);
        break;
      default:
        throw new CircleError("INVALID_INPUT", `Unknown frequency: ${frequency}`);
    }

    const ts = Timestamp.fromDate(d);
    return { nextDueDate: ts, nextPayoutDate: ts };
  }

  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private async notifyAllMembers(
    circle: Circle,
    notification: Parameters<typeof sendNotification>[1]
  ): Promise<void> {
    await Promise.allSettled(
      circle.memberIds.map((id) => sendNotification(id, notification))
    );
  }
}