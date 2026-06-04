import { debitWallet, creditWallet, addPending, confirmPending } from "@/lib/services/wallet-service";
import {
  getSettings,
  getCircleSettings,
  getPayoutSettings,
} from "@/lib/services/settings-service";
/**
 * Circle Service
 *
 * Key changes:
 * - Creation fee: now % of TOTAL POOL (contribution × maxMembers), not just contribution
 * - Join fee: optional fee each new member pays when joining
 *   - "before_joining": deducted from wallet immediately on join
 *   - "first_contribution": queued in pendingJoinFees, deducted alongside first contribution
 */

import { adminDb, admin } from "@/lib/firebase/admin";
import * as eventTrigger from "@/lib/services/event-trigger";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { DEFAULT_PLATFORM_SETTINGS } from "@/lib/types/admin-settings";
import { sendNotification } from "@/lib/services/notification-service";
import * as smsService from "@/lib/services/sms-service";
import {
  sendDueRemindersForCircle,
  sendPayoutNotification,
  sendLatePaymentWarning,
  sendContributionReceipt,
} from "@/lib/services/circle-notification-helpers";
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
    invitePermission: Circle["invitePermission"],
    tags: string[],
    joinFeeEnabled: boolean = false,
    joinFeeKobo: number = 0,
    joinFeeType: Circle["joinFeeType"] = "before_joining"
  ): Promise<Circle> {
    const settings = await getCircleSettings();

    if (maxMembers < settings.minCircleMembers) {
      throw new CircleError("INVALID_INPUT", `Circle must have at least ${settings.minCircleMembers} members.`);
    }
    if (contributionKobo < settings.minContributionKobo) {
      throw new CircleError("INVALID_INPUT", `Minimum contribution is ₦${settings.minContributionKobo / 100}.`);
    }
    if (contributionKobo > settings.maxContributionKobo) {
      throw new CircleError("INVALID_INPUT", `Maximum contribution is ₦${settings.maxContributionKobo / 100}.`);
    }
    if (maxMembers > settings.maxCircleMembers) {
      throw new CircleError("INVALID_INPUT", `Maximum members allowed is ${settings.maxCircleMembers}.`);
    }

    // Validate join fee
    if (joinFeeEnabled && joinFeeKobo < 0) {
      throw new CircleError("INVALID_INPUT", "Join fee cannot be negative.");
    }
    if (joinFeeEnabled && joinFeeKobo === 0) {
      // Allow zero join fee (admin wants to signal optional fee), but disable silently
      joinFeeEnabled = false;
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

    // ── Creation fee: % of TOTAL POOL (contribution × maxMembers) ────────────
    const totalPool = contributionKobo * maxMembers;
    const creationFee = Math.round(totalPool * (settings.creationFeePercent / 100));

    if (adminWallet.available < creationFee) {
      throw new CircleError(
        "INSUFFICIENT_FUNDS",
        `Insufficient wallet balance for creation fee of ₦${creationFee / 100}. ` +
        `(${settings.creationFeePercent}% of total pool ₦${totalPool / 100})`
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
        // Join fee config
        joinFeeEnabled,
        joinFee: joinFeeEnabled ? joinFeeKobo : 0,
        joinFeeType: joinFeeEnabled ? joinFeeType : "before_joining",
        pendingJoinFees: [], // admin doesn't pay their own join fee
        tags: tags.slice(0, 5),
        pendingRequestIds: [],
        inviteCode,
        invitePermission: invitePermission === "members" ? "members" : "admin",
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
    const result = await adminDb.runTransaction(async (tx) => {
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

      const settings = await getCircleSettings();
      const activeCount = await this.countActiveCircles(userId);
      if (activeCount >= settings.maxActiveCirclesPerUser) {
        throw new CircleError(
          "MAX_CIRCLES_REACHED",
          `You can be in a maximum of ${settings.maxActiveCirclesPerUser} active circles.`
        );
      }

      if (circle.isPrivate) {
        if (!inviteCode || circle.inviteCode !== inviteCode.toUpperCase()) {
          throw new CircleError("INVALID_INVITE_CODE", "Invalid invite code.");
        }
      }

      // ── Join fee: "before_joining" — deduct from wallet now ────────────────
      if (circle.joinFeeEnabled && circle.joinFee > 0 && circle.joinFeeType === "before_joining") {
        const walletSnap = await tx.get(this.walletsCol.doc(userId));
        if (!walletSnap.exists) {
          throw new CircleError("NOT_FOUND", "Wallet not found.");
        }
        const wallet = walletSnap.data() as { available: number };
        if (wallet.available < circle.joinFee) {
          throw new CircleError(
            "INSUFFICIENT_FUNDS",
            `Insufficient wallet balance for the join fee of ₦${circle.joinFee / 100}. ` +
            `Please fund your wallet and try again.`
          );
        }
        // Debit join fee from member's wallet, credit to circle admin
        await debitWallet(
          tx,
          userId,
          circle.joinFee,
          "contribution",
          `Join fee for circle "${circle.name}"`,
          { circleId }
        );
        await creditWallet(
          tx,
          circle.adminId,
          circle.joinFee,
          "payout",
          `Join fee received from ${user.name} for circle "${circle.name}"`,
          { circleId }
        );
      }

      const updatedMemberIds = [...circle.memberIds, userId];

      // ── Join fee: "first_contribution" — queue for later collection ─────────
      const updatedPendingJoinFees =
        circle.joinFeeEnabled && circle.joinFee > 0 && circle.joinFeeType === "first_contribution"
          ? [...(circle.pendingJoinFees ?? []), userId]
          : (circle.pendingJoinFees ?? []);

      const now = FieldValue.serverTimestamp();

      tx.update(this.circlesCol.doc(circleId), {
        memberIds: updatedMemberIds,
        pendingJoinFees: updatedPendingJoinFees,
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
        body: `${user.name} joined your circle "${circle.name}".` +
          (circle.joinFeeEnabled && circle.joinFeeType === "before_joining"
            ? ` Join fee of ₦${circle.joinFee / 100} has been credited to your wallet.`
            : circle.joinFeeEnabled && circle.joinFeeType === "first_contribution"
            ? ` Join fee of ₦${circle.joinFee / 100} will be collected on their first contribution.`
            : ""),
        link: `/circles/${circleId}`,
      });
      void sendNotification(userId, {
        type: "general",
        title: "Welcome to the Circle!",
        body: `You successfully joined "${circle.name}".` +
          (circle.joinFeeEnabled && circle.joinFee > 0 && circle.joinFeeType === "first_contribution"
            ? ` A join fee of ₦${circle.joinFee / 100} will be deducted alongside your first contribution.`
            : ""),
        link: `/circles/${circleId}`,
      });

      return {
        ...circle,
        memberIds: updatedMemberIds,
        pendingJoinFees: updatedPendingJoinFees,
        goal: circle.contribution * circle.maxMembers,
      } as Circle;
    });

    // Post-transaction triggers
    try {
      if (result.memberIds.length === result.maxMembers) {
        void eventTrigger.triggerCircleFilled(result.adminId, circleId, result.name, result.maxMembers);
      }
      try {
        const userSnap = await adminDb.collection("users").doc(userId).get();
        const circleIds = (userSnap.data()?.circleIds as string[] | undefined) ?? [];
        if (circleIds.length === 1) {
          void eventTrigger.triggerFirstCircleJoined(userId, circleId, result.name);
        }
      } catch (err) {
        console.error("Failed to post-process joinCircle triggers:", err);
      }
    } catch (err) {
      console.error("Error firing joinCircle triggers:", err);
    }

    return result;
  }

  // ─── Contribute ────────────────────────────────────────────────────────────

  async makeContribution(circleId: string, userId: string, amountKobo: number): Promise<Contribution> {
    const settings = await getCircleSettings();

    const contribResult = await adminDb.runTransaction(async (tx) => {
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
      const wallet = walletSnap.data() as { available: number };

      if (!circle.memberIds.includes(userId)) {
        throw new CircleError("NOT_MEMBER", "You are not a member of this circle.");
      }
      if (circle.status !== "active") {
        throw new CircleError("CIRCLE_INACTIVE", "This circle is not active.");
      }
      if (amountKobo !== circle.contribution) {
        throw new CircleError("INVALID_AMOUNT", `Contribution must be exactly ₦${circle.contribution / 100}.`);
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

      // ── Pending join fee: collect alongside first contribution ─────────────
      const hasPendingJoinFee =
        circle.joinFeeEnabled &&
        circle.joinFee > 0 &&
        circle.joinFeeType === "first_contribution" &&
        (circle.pendingJoinFees ?? []).includes(userId);

      let penaltyKobo = 0;
      let circleAdminWalletRef: admin.firestore.DocumentReference | null = null;
      let circleAdminShareKobo = 0;

      if (contrib.status === "late" && !contrib.penaltyPaid) {
        penaltyKobo = Math.round(circle.contribution * (settings.latePenaltyPercent / 100));
        if (settings.latePenaltySplitEnabled && settings.latePenaltyCircleAdminSharePercent > 0) {
          circleAdminShareKobo = Math.round(penaltyKobo * (settings.latePenaltyCircleAdminSharePercent / 100));
          if (circleAdminShareKobo > 0) {
            circleAdminWalletRef = this.walletsCol.doc(circle.adminId);
            const circleAdminWalletSnap = await tx.get(circleAdminWalletRef);
            if (!circleAdminWalletSnap.exists) {
              throw new CircleError("NOT_FOUND", "Circle admin wallet not found for penalty split.");
            }
          }
        }
      }

      const joinFeeAmount = hasPendingJoinFee ? circle.joinFee : 0;
      const totalDeduction = amountKobo + penaltyKobo + joinFeeAmount;

      if (wallet.available < totalDeduction) {
        const breakdown = [
          `contribution ₦${amountKobo / 100}`,
          penaltyKobo > 0 ? `late penalty ₦${penaltyKobo / 100}` : null,
          joinFeeAmount > 0 ? `join fee ₦${joinFeeAmount / 100}` : null,
        ].filter(Boolean).join(" + ");
        throw new CircleError(
          "INSUFFICIENT_FUNDS",
          `Insufficient funds. Need ₦${totalDeduction / 100} (${breakdown}) but have ₦${wallet.available / 100}.`
        );
      }

      // Debit contribution
      const contribTxId = await debitWallet(
        tx,
        userId,
        amountKobo,
        "contribution",
        `Contribution to "${circle.name}" — Cycle ${circle.currentCycle}`,
        { circleId },
      );

      // Debit late penalty if applicable
      if (penaltyKobo > 0) {
        const userWalletRef = this.walletsCol.doc(userId);
        tx.update(userWalletRef, {
          available: FieldValue.increment(-penaltyKobo),
          updatedAt: FieldValue.serverTimestamp(),
        });

        const penaltyTxRef = this.transactionsCol.doc();
        tx.set(penaltyTxRef, {
          id: penaltyTxRef.id,
          userId,
          circleId,
          type: "penalty",
          direction: "debit",
          amount: penaltyKobo,
          fee: 0,
          netAmount: penaltyKobo,
          status: "success",
          reference: penaltyTxRef.id,
          description: `Late penalty for "${circle.name}" — Cycle ${circle.currentCycle}`,
          createdAt: FieldValue.serverTimestamp() as any,
          updatedAt: FieldValue.serverTimestamp() as any,
        });

        if (circleAdminWalletRef && circleAdminShareKobo > 0) {
          tx.update(circleAdminWalletRef, {
            available: FieldValue.increment(circleAdminShareKobo),
            updatedAt: FieldValue.serverTimestamp(),
          });
          const creditTxRef = this.transactionsCol.doc();
          tx.set(creditTxRef, {
            id: creditTxRef.id,
            userId: circle.adminId,
            circleId,
            type: "penalty",
            direction: "credit",
            amount: circleAdminShareKobo,
            fee: 0,
            netAmount: circleAdminShareKobo,
            status: "success",
            reference: creditTxRef.id,
            description: `Late penalty share from "${circle.name}" — Cycle ${circle.currentCycle}`,
            createdAt: FieldValue.serverTimestamp() as any,
            updatedAt: FieldValue.serverTimestamp() as any,
          });
        }
      }

      // ── Debit + credit join fee alongside first contribution ───────────────
      if (hasPendingJoinFee) {
        await debitWallet(
          tx,
          userId,
          joinFeeAmount,
          "contribution",
          `Join fee for circle "${circle.name}"`,
          { circleId }
        );
        await creditWallet(
          tx,
          circle.adminId,
          joinFeeAmount,
          "payout",
          `Join fee from ${user.name} for circle "${circle.name}"`,
          { circleId }
        );
        // Remove from pendingJoinFees
        tx.update(this.circlesCol.doc(circleId), {
          pendingJoinFees: FieldValue.arrayRemove(userId),
        });
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

      if (contrib.status === "pending") {
        await recordOnTimePayment(tx, circleId, circle.trustScoreBreakdown);
      }

      void sendContributionReceipt(userId, user, circle, amountKobo);

      return { ...contrib, status: "paid", paidAt: Timestamp.now(), transactionId: contribTxId } as Contribution;
    });

    // Post-transaction event triggers
    try {
      const paidSnap = await adminDb
        .collection("contributions")
        .where("userId", "==", userId)
        .where("status", "==", "paid")
        .get();
      if (paidSnap.size === 1) {
        void eventTrigger.triggerFirstContribution(userId);
      }
    } catch (err) {
      console.error("Failed to check first contribution:", err);
    }

    try {
      const recent = await adminDb
        .collection("contributions")
        .where("userId", "==", userId)
        .where("status", "==", "paid")
        .orderBy("paidAt", "desc")
        .limit(20)
        .get();
      let consecutive = 0;
      for (const d of recent.docs) {
        if ((d.data() as any).penaltyAmount) break;
        consecutive++;
      }
      if (consecutive > 0) {
        void eventTrigger.triggerContributionStreak(userId, circleId, consecutive);
      }
    } catch (err) {
      console.error("Failed to compute contribution streak:", err);
    }

    return contribResult;
  }

  // ─── Process Payouts (cron) ────────────────────────────────────────────────

  async processPayouts(): Promise<void> {
    const now = Timestamp.now();
    let settlementHours = DEFAULT_PLATFORM_SETTINGS.payouts.settlementPeriodHours;
    try {
      const payoutSettings = await getPayoutSettings();
      settlementHours = payoutSettings.settlementPeriodHours;
    } catch (err) {
      console.warn("Failed to read platform payout settings, using defaults", err);
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

    try {
      await this.settlePendingPayouts(settlementHours);
    } catch (err) {
      console.error("[circle-service] Failed to settle pending payouts:", err);
    }
  }

  private async processSinglePayout(
    circleDoc: admin.firestore.QueryDocumentSnapshot,
    settlementHours: number
  ): Promise<void> {
    const circle = circleDoc.data() as Circle;
    const payoutSettings = await getPayoutSettings();
    const circleSettings = await getCircleSettings();

    const paidSnap = await this.contributionsCol
      .where("circleId", "==", circle.id)
      .where("cycle", "==", circle.currentCycle)
      .where("status", "==", "paid")
      .get();

    if (paidSnap.size < circle.memberIds.length) return;

    await adminDb.runTransaction(async (tx) => {
      const circleRef = this.circlesCol.doc(circle.id);
      let recipientId = circle.currentRecipientId;
      let bidPremiumKobo = 0;
      let winningBidRef: admin.firestore.DocumentReference | null = null;

      const pausedMembers = new Set(circle.pausedMemberIds ?? []);
      const eligibleMemberIds = circle.memberIds.filter((id) => !pausedMembers.has(id));
      if (eligibleMemberIds.length === 0) return;

      if (circle.payoutOrder === "bidding") {
        const bidResult = await this.resolveWinningBid(circle, tx, circleSettings, eligibleMemberIds);
        if (bidResult) {
          recipientId = bidResult.userId;
          bidPremiumKobo = bidResult.amount;
          winningBidRef = bidResult.ref;
        }
      }

      if (circle.payoutOrder === "random") {
        recipientId = eligibleMemberIds[Math.floor(Math.random() * eligibleMemberIds.length)];
      }

      if (circle.payoutOrder === "rotational") {
        if (pausedMembers.has(recipientId) || !eligibleMemberIds.includes(recipientId)) {
          recipientId = this.advanceRecipient(circle, recipientId, eligibleMemberIds);
        }
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
              await creditWallet(tx, memberId, shareKobo, "payout",
                `Bid premium share from "${circle.name}" — Cycle ${circle.currentCycle}`,
                { circleId: circle.id }
              );
            }
          }
        }
      }

      if (settlementHours > 0) {
        await addPending(tx, recipientId, netPayout);
        const pendingTxRef = adminDb.collection("transactions").doc();
        tx.set(pendingTxRef, {
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
        });
      } else {
        await creditWallet(tx, recipientId, netPayout, "payout",
          `Payout from "${circle.name}" — Cycle ${circle.currentCycle}`,
          { circleId: circle.id }
        );
      }

      const nextCycle = circle.currentCycle + 1;
      const isComplete = nextCycle > circle.totalCycles;
      const nextRecipientId = isComplete ? "" : this.advanceRecipient(circle, recipientId, eligibleMemberIds);
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
          await confirmPending(tx, userId, amount);
          tx.update(txDoc.ref, { status: "success", updatedAt: FieldValue.serverTimestamp() });

          const userSnap = await tx.get(this.usersCol.doc(userId));
          const circleSnap = data.circleId ? await tx.get(this.circlesCol.doc(data.circleId)) : null;
          const user = userSnap.exists ? (userSnap.data() as User) : null;
          const circle = circleSnap && circleSnap.exists ? (circleSnap.data() as Circle) : null;
          if (user) {
            void sendPayoutNotification(
              userId, user,
              circle ? circle.name : (data.circleId as string) || "",
              (data.circleId as string) || "",
              amount,
              { grossPayoutKobo: amount, platformFeeKobo: 0, transactionReference: txDoc.id, payoutDate: new Date() }
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

      const missedSnap = await this.contributionsCol
        .where("circleId", "==", contrib.circleId)
        .where("userId", "==", contrib.userId)
        .where("status", "==", "missed")
        .orderBy("cycle", "desc")
        .limit(settings.consecutiveMissedLimit)
        .get();

      if (missedSnap.size >= settings.consecutiveMissedLimit - 1) {
        tx.update(contribDoc.ref, { status: "missed", updatedAt: FieldValue.serverTimestamp() });
        await recordMissedPayment(tx, contrib.circleId, circle.trustScoreBreakdown);
        tx.update(this.circlesCol.doc(contrib.circleId), {
          memberIds: FieldValue.arrayRemove(contrib.userId),
          pendingJoinFees: FieldValue.arrayRemove(contrib.userId), // clean up if pending
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

      tx.update(contribDoc.ref, { status: "late", updatedAt: FieldValue.serverTimestamp() });
      await recordLatePayment(tx, contrib.circleId, circle.trustScoreBreakdown);
      const penaltyKobo = Math.round(circle.contribution * settings.latePenaltyPercent);
      void sendLatePaymentWarning(contrib.userId, user, circle, penaltyKobo);
    });
  }

  // ─── Bid ───────────────────────────────────────────────────────────────────

  async submitBid(circleId: string, userId: string, bidPremiumKobo: number): Promise<Bid> {
    if (bidPremiumKobo <= 0) throw new CircleError("INVALID_INPUT", "Bid amount must be positive.");
    const settings = await getCircleSettings();

    return adminDb.runTransaction(async (tx) => {
      const circleSnap = await tx.get(this.circlesCol.doc(circleId));
      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");
      const circle = circleSnap.data() as Circle;

      if (circle.payoutOrder !== "bidding") throw new CircleError("INVALID_OPERATION", "Bidding is only for bidding-order circles.");
      if (!circle.memberIds.includes(userId)) throw new CircleError("NOT_MEMBER", "You are not a member of this circle.");

      const deadline = new Date(circle.nextPayoutDate.toDate());
      deadline.setHours(deadline.getHours() - settings.bidCloseHoursBeforePayout);
      if (new Date() > deadline) throw new CircleError("BID_CLOSED", "Bidding for this cycle has closed.");

      const existingBidSnap = await this.bidsCol
        .where("circleId", "==", circleId)
        .where("userId", "==", userId)
        .where("cycle", "==", circle.currentCycle)
        .where("status", "==", "active")
        .limit(1)
        .get();
      if (!existingBidSnap.empty) throw new CircleError("DUPLICATE_BID", "You already have an active bid.");

      const bidRef = this.bidsCol.doc();
      const bidData: Omit<Bid, "id"> = {
        circleId, cycle: circle.currentCycle, userId,
        amount: bidPremiumKobo, status: "active",
        deadline: Timestamp.fromDate(deadline),
        createdAt: FieldValue.serverTimestamp() as any,
      };
      tx.set(bidRef, bidData);
      void sendNotification(circle.adminId, {
        type: "general",
        title: "New Bid",
        body: `A member placed a ₦${bidPremiumKobo / 100} bid for "${circle.name}".`,
        link: `/circles/${circleId}`,
      });
      return { id: bidRef.id, ...bidData } as Bid;
    });
  }

  // ─── Member management ─────────────────────────────────────────────────────

  async pauseMember(circleId: string, memberId: string, adminId: string, allowPlatformAdmin = false): Promise<Circle> {
    return adminDb.runTransaction(async (tx) => {
      const circleRef = this.circlesCol.doc(circleId);
      const [circleSnap, memberSnap] = await tx.getAll(circleRef, this.usersCol.doc(memberId));
      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");
      if (!memberSnap.exists) throw new CircleError("NOT_FOUND", "Member not found.");
      const circle = circleSnap.data() as Circle;
      const member = memberSnap.data() as User;
      if (circle.adminId !== adminId && !allowPlatformAdmin) throw new CircleError("UNAUTHORIZED", "Only the circle admin can pause members.");
      if (!circle.memberIds.includes(memberId)) throw new CircleError("NOT_MEMBER", "User is not a member.");
      const paused = circle.pausedMemberIds ?? [];
      if (paused.includes(memberId)) throw new CircleError("INVALID_OPERATION", "Member is already paused.");
      tx.update(circleRef, { pausedMemberIds: FieldValue.arrayUnion(memberId), updatedAt: FieldValue.serverTimestamp() });
      void sendNotification(memberId, { type: "general", title: "Member Paused", body: `Your payout eligibility in "${circle.name}" has been suspended.`, link: `/circles/${circleId}` });
      void sendNotification(circle.adminId, { type: "general", title: "Member Paused", body: `${member.name} has been paused in "${circle.name}".`, link: `/circles/${circleId}` });
      return { ...circle, pausedMemberIds: [...paused, memberId] } as Circle;
    });
  }

  async resumeMember(circleId: string, memberId: string, adminId: string, allowPlatformAdmin = false): Promise<Circle> {
    return adminDb.runTransaction(async (tx) => {
      const circleRef = this.circlesCol.doc(circleId);
      const [circleSnap, memberSnap] = await tx.getAll(circleRef, this.usersCol.doc(memberId));
      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");
      if (!memberSnap.exists) throw new CircleError("NOT_FOUND", "Member not found.");
      const circle = circleSnap.data() as Circle;
      const member = memberSnap.data() as User;
      if (circle.adminId !== adminId && !allowPlatformAdmin) throw new CircleError("UNAUTHORIZED", "Only the circle admin can resume members.");
      if (!circle.memberIds.includes(memberId)) throw new CircleError("NOT_MEMBER", "User is not a member.");
      const paused = circle.pausedMemberIds ?? [];
      if (!paused.includes(memberId)) throw new CircleError("INVALID_OPERATION", "Member is not paused.");
      tx.update(circleRef, { pausedMemberIds: FieldValue.arrayRemove(memberId), updatedAt: FieldValue.serverTimestamp() });
      void sendNotification(memberId, { type: "general", title: "Member Resumed", body: `Your payout eligibility in "${circle.name}" has been restored.`, link: `/circles/${circleId}` });
      void sendNotification(circle.adminId, { type: "general", title: "Member Resumed", body: `${member.name} is now eligible for payouts in "${circle.name}".`, link: `/circles/${circleId}` });
      return { ...circle, pausedMemberIds: paused.filter((id) => id !== memberId) } as Circle;
    });
  }

  async shiftMember(circleId: string, memberId: string, adminId: string, allowPlatformAdmin = false): Promise<Circle> {
    return adminDb.runTransaction(async (tx) => {
      const circleRef = this.circlesCol.doc(circleId);
      const [circleSnap, memberSnap] = await tx.getAll(circleRef, this.usersCol.doc(memberId));
      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");
      if (!memberSnap.exists) throw new CircleError("NOT_FOUND", "Member not found.");
      const circle = circleSnap.data() as Circle;
      const member = memberSnap.data() as User;
      if (circle.adminId !== adminId && !allowPlatformAdmin) throw new CircleError("UNAUTHORIZED", "Only the circle admin can shift members.");
      if (circle.payoutOrder !== "rotational") throw new CircleError("INVALID_OPERATION", "Member shifting is only for rotational circles.");
      if (!circle.memberIds.includes(memberId)) throw new CircleError("NOT_MEMBER", "User is not a member.");
      if (memberId === circle.currentRecipientId) throw new CircleError("INVALID_OPERATION", "This member already has the next payout.");
      const updatedMemberIds = circle.memberIds.filter((id) => id !== memberId);
      const currentIndex = updatedMemberIds.indexOf(circle.currentRecipientId);
      const insertAt = currentIndex === -1 ? 0 : currentIndex + 1;
      updatedMemberIds.splice(insertAt, 0, memberId);
      tx.update(circleRef, { memberIds: updatedMemberIds, updatedAt: FieldValue.serverTimestamp() });
      void sendNotification(memberId, { type: "general", title: "Payout Priority Changed", body: `Your payout position in "${circle.name}" has been updated.`, link: `/circles/${circleId}` });
      void sendNotification(circle.adminId, { type: "general", title: "Member Shifted", body: `${member.name} has been moved up in the payout queue for "${circle.name}".`, link: `/circles/${circleId}` });
      return { ...circle, memberIds: updatedMemberIds } as Circle;
    });
  }

  async updateInvitePermission(circleId: string, adminId: string, invitePermission: Circle["invitePermission"], allowPlatformAdmin = false): Promise<Circle> {
    if (!["admin", "members"].includes(invitePermission)) throw new CircleError("INVALID_INPUT", "Invalid invite permission.");
    return adminDb.runTransaction(async (tx) => {
      const circleRef = this.circlesCol.doc(circleId);
      const circleSnap = await tx.get(circleRef);
      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");
      const circle = circleSnap.data() as Circle;
      if (circle.adminId !== adminId && !allowPlatformAdmin) throw new CircleError("UNAUTHORIZED", "Only the circle admin can update invite permissions.");
      tx.update(circleRef, { invitePermission, updatedAt: FieldValue.serverTimestamp() });
      void sendNotification(circle.adminId, { type: "general", title: "Invite Settings Updated", body: `Invite permissions for "${circle.name}" updated.`, link: `/circles/${circleId}` });
      return { ...circle, invitePermission } as Circle;
    });
  }

  // ─── Pause / Unpause circle ────────────────────────────────────────────────

  async pauseCircle(circleId: string, adminId: string): Promise<Circle> {
    return adminDb.runTransaction(async (tx) => {
      const circleSnap = await tx.get(this.circlesCol.doc(circleId));
      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");
      const circle = circleSnap.data() as Circle;
      if (circle.adminId !== adminId) throw new CircleError("UNAUTHORIZED", "Only the circle admin can pause.");
      if (circle.status === "paused") throw new CircleError("INVALID_OPERATION", "Circle is already paused.");
      if (circle.status !== "active") throw new CircleError("INVALID_OPERATION", `Cannot pause a ${circle.status} circle.`);
      tx.update(this.circlesCol.doc(circleId), { status: "paused", updatedAt: FieldValue.serverTimestamp() });
      void this.notifyAllMembers(circle, { type: "general", title: "Circle Paused", body: `"${circle.name}" has been paused by the admin.`, link: `/circles/${circleId}` });
      return { ...circle, status: "paused" } as Circle;
    });
  }

  async unpauseCircle(circleId: string, adminId: string): Promise<Circle> {
    return adminDb.runTransaction(async (tx) => {
      const circleSnap = await tx.get(this.circlesCol.doc(circleId));
      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");
      const circle = circleSnap.data() as Circle;
      if (circle.adminId !== adminId) throw new CircleError("UNAUTHORIZED", "Only the circle admin can unpause.");
      if (circle.status !== "paused") throw new CircleError("INVALID_OPERATION", "Circle is not paused.");
      const { nextDueDate, nextPayoutDate } = this.nextDates(circle.frequency, new Date());
      tx.update(this.circlesCol.doc(circleId), { status: "active", nextDueDate, nextPayoutDate, updatedAt: FieldValue.serverTimestamp() });
      void this.notifyAllMembers(circle, { type: "general", title: "Circle Resumed", body: `"${circle.name}" has been unpaused.`, link: `/circles/${circleId}` });
      return { ...circle, status: "active", nextDueDate, nextPayoutDate } as Circle;
    });
  }

  // ─── Remove member ─────────────────────────────────────────────────────────

  async removeMember(circleId: string, memberId: string, adminId: string): Promise<Circle> {
    return adminDb.runTransaction(async (tx) => {
      const [circleSnap, memberSnap] = await tx.getAll(this.circlesCol.doc(circleId), this.usersCol.doc(memberId));
      if (!circleSnap.exists) throw new CircleError("NOT_FOUND", "Circle not found.");
      if (!memberSnap.exists) throw new CircleError("NOT_FOUND", "Member not found.");
      const circle = circleSnap.data() as Circle;
      const member = memberSnap.data() as User;
      if (circle.adminId !== adminId) throw new CircleError("UNAUTHORIZED", "Only the circle admin can remove members.");
      if (memberId === adminId) throw new CircleError("INVALID_OPERATION", "Admin cannot remove themselves.");
      if (!circle.memberIds.includes(memberId)) throw new CircleError("NOT_MEMBER", "User is not a member.");
      const updatedMemberIds = circle.memberIds.filter((id) => id !== memberId);
      const now = FieldValue.serverTimestamp();
      tx.update(this.circlesCol.doc(circleId), {
        memberIds: updatedMemberIds,
        pendingJoinFees: FieldValue.arrayRemove(memberId),
        updatedAt: now,
      });
      tx.update(this.usersCol.doc(memberId), { circleIds: FieldValue.arrayRemove(circleId), updatedAt: now });
      const pendingContribsSnap = await this.contributionsCol
        .where("circleId", "==", circleId)
        .where("userId", "==", memberId)
        .where("status", "==", "pending")
        .get();
      for (const d of pendingContribsSnap.docs) {
        tx.update(d.ref, { status: "cancelled", updatedAt: now });
      }
      void sendNotification(memberId, { type: "general", title: "Removed from Circle", body: `You have been removed from "${circle.name}".`, link: "/circles" });
      void sendNotification(adminId, { type: "general", title: "Member Removed", body: `${member.name} has been removed from "${circle.name}".`, link: `/circles/${circleId}` });
      return { ...circle, memberIds: updatedMemberIds } as Circle;
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async requireUser(userId: string): Promise<User> {
    const snap = await this.usersCol.doc(userId).get();
    if (!snap.exists) throw new CircleError("NOT_FOUND", `User ${userId} not found.`);
    return snap.data() as User;
  }

  private async requireWallet(userId: string): Promise<{ available: number }> {
    const snap = await this.walletsCol.doc(userId).get();
    if (!snap.exists) throw new CircleError("NOT_FOUND", `Wallet for user ${userId} not found.`);
    return snap.data() as { available: number };
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
    settings: Awaited<ReturnType<typeof getCircleSettings>>,
    eligibleMemberIds?: string[]
  ): Promise<{ userId: string; amount: number; ref: admin.firestore.DocumentReference } | null> {
    const deadline = new Date(circle.nextPayoutDate.toDate());
    deadline.setHours(deadline.getHours() - settings.bidCloseHoursBeforePayout);
    if (new Date() < deadline) return null;
    const snap = await this.bidsCol
      .where("circleId", "==", circle.id)
      .where("cycle", "==", circle.currentCycle)
      .where("status", "==", "active")
      .get();
    const bids = snap.docs
      .map((doc) => ({ ref: doc.ref, data: doc.data() as Bid }))
      .filter((bid) => !eligibleMemberIds || eligibleMemberIds.includes(bid.data.userId))
      .sort((a, b) => b.data.amount - a.data.amount);
    if (bids.length === 0) return null;
    const topBid = bids[0];
    return { userId: topBid.data.userId, amount: topBid.data.amount, ref: topBid.ref };
  }

  private advanceRecipient(circle: Circle, currentRecipientId: string, eligibleMemberIds?: string[]): string {
    if (circle.payoutOrder !== "rotational") return currentRecipientId;
    const ordered = eligibleMemberIds && eligibleMemberIds.length > 0 ? eligibleMemberIds : circle.memberIds;
    const idx = ordered.indexOf(currentRecipientId);
    if (idx === -1) return ordered[0] ?? currentRecipientId;
    return ordered[(idx + 1) % ordered.length];
  }

  private nextDates(frequency: Circle["frequency"], from: Date): { nextDueDate: Timestamp; nextPayoutDate: Timestamp } {
    const d = new Date(from);
    d.setUTCHours(9, 0, 0, 0);
    switch (frequency) {
      case "daily": d.setUTCDate(d.getUTCDate() + 1); break;
      case "weekly": d.setUTCDate(d.getUTCDate() + 7); break;
      case "bi-weekly": d.setUTCDate(d.getUTCDate() + 14); break;
      case "monthly": d.setUTCMonth(d.getUTCMonth() + 1); break;
      default: throw new CircleError("INVALID_INPUT", `Unknown frequency: ${frequency}`);
    }
    const ts = Timestamp.fromDate(d);
    return { nextDueDate: ts, nextPayoutDate: ts };
  }

  private generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  private async notifyAllMembers(circle: Circle, notification: Parameters<typeof sendNotification>[1]): Promise<void> {
    await Promise.allSettled(circle.memberIds.map((id) => sendNotification(id, notification)));
  }
}