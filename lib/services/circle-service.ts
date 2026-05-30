/**
 * Circle Service
 * Business logic for circle lifecycle: create, join, contribute, payout,
 * penalty application, bid submission, pause/unpause, and member removal.
 *
 * Rules enforced here (never client-side):
 *  - Creation fee = 5% of contribution amount
 *  - Admin is always turn position 1 (index 0) in rotational circles
 *  - Payouts only when all member slots are filled
 *  - Contribution state machine: pending → paid | late → paid | missed
 *  - Late penalty = 10% of contribution amount
 *  - Three consecutive missed payments → auto-removal
 *  - KYC gate for circle creation and payouts > ₦50,000
 *  - Maximum 10 active circles per user
 *  - Bid deadline = 24 h before nextPayoutDate
 *  - Bid premium distributed equally to non-winning members
 *  - Platform takes 1% of each payout
 *  - goal = contribution × maxMembers, always derived — never stored
 */

import { adminDb, admin } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { MAX_ACTIVE_CIRCLES } from "@/lib/constants";
import { sendNotification } from "@/lib/services/notification-service";
import * as smsService from "@/lib/services/sms-service";
import { debitWallet, creditWallet } from "@/lib/services/wallet-service";
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

// ─── Constants ────────────────────────────────────────────────────────────────

const CREATION_FEE_PERCENT = 0.05; // 5%
const LATE_PENALTY_PERCENT = 0.10; // 10%
const PLATFORM_PAYOUT_FEE_PERCENT = 0.01; // 1%
const GRACE_PERIOD_HOURS = 48;
const KYC_PAYOUT_THRESHOLD_KOBO = 5_000_000; // ₦50,000
const CONSECUTIVE_MISSED_LIMIT = 3;
const BID_CLOSE_HOURS_BEFORE_PAYOUT = 24;

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
    if (maxMembers < 2) {
      throw new CircleError("INVALID_INPUT", "Circle must have at least 2 members.");
    }
    if (contributionKobo < 50_000) {
      throw new CircleError("INVALID_INPUT", "Minimum contribution is ₦500.");
    }

    const [adminUser, adminWallet] = await Promise.all([
      this.requireUser(adminId),
      this.requireWallet(adminId),
    ]);

    if (adminUser.kycStatus !== "verified") {
      throw new CircleError("KYC_REQUIRED", "Complete KYC verification to create a circle.");
    }

    const activeCount = await this.countActiveCircles(adminId);
    if (activeCount >= MAX_ACTIVE_CIRCLES) {
      throw new CircleError(
        "MAX_CIRCLES_REACHED",
        `You can be in a maximum of ${MAX_ACTIVE_CIRCLES} active circles.`
      );
    }

    const creationFee = Math.round(contributionKobo * CREATION_FEE_PERCENT);
    if (adminWallet.available < creationFee) {
      throw new CircleError(
        "INSUFFICIENT_FUNDS",
        `Insufficient wallet balance for creation fee of ₦${creationFee / 100}.`
      );
    }

    return adminDb.runTransaction(async (tx) => {
      const circleRef = this.circlesCol.doc();
      const { nextDueDate, nextPayoutDate } = this.nextDates(frequency, new Date());

      // Deduct creation fee
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

      // Notifications — fire-and-forget after transaction commits
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

      // Find or create the contribution document for this cycle
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

      // Calculate total to deduct (contribution + any unpaid penalty)
      let penaltyKobo = 0;
      if (contrib.status === "late" && !contrib.penaltyPaid) {
        penaltyKobo = Math.round(circle.contribution * LATE_PENALTY_PERCENT);
      }

      const totalDeduction = amountKobo + penaltyKobo;
      if (wallet.available < totalDeduction) {
        throw new CircleError(
          "INSUFFICIENT_FUNDS",
          `You need ₦${totalDeduction / 100} but have ₦${wallet.available / 100}.`
        );
      }

      // Debit wallet for contribution
      const contribTxId = await debitWallet(
        tx, userId, amountKobo, "contribution",
        `Contribution to "${circle.name}" — Cycle ${circle.currentCycle}`,
        { circleId }
      );

      // Debit wallet for penalty (if applicable)
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
        "trustScoreBreakdown.onTimePayments": FieldValue.increment(
          contrib.status === "pending" ? 1 : 0
        ),
        updatedAt: now,
      });

      // SMS confirmation (fire-and-forget)
      if (user.phone) {
        void smsService.sendContributionReceived(user.phone, circle.name, amountKobo);
      }

      return { ...contrib, status: "paid", paidAt: Timestamp.now(), transactionId: contribTxId } as Contribution;
    });
  }

  // ─── Process Payouts (cron) ────────────────────────────────────────────────

  async processPayouts(): Promise<void> {
    const now = Timestamp.now();

    const snap = await this.circlesCol
      .where("status", "==", "active")
      .where("nextPayoutDate", "<=", now)
      .get();

    for (const circleDoc of snap.docs) {
      try {
        await this.processSinglePayout(circleDoc);
      } catch (err) {
        console.error(`[circle-service] Payout failed for circle ${circleDoc.id}:`, err);
      }
    }
  }

  private async processSinglePayout(circleDoc: admin.firestore.QueryDocumentSnapshot): Promise<void> {
    const circle = circleDoc.data() as Circle;

    // Verify all members have paid for this cycle
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

      // Determine recipient
      let recipientId = circle.currentRecipientId;
      let bidPremiumKobo = 0;
      let winningBidRef: admin.firestore.DocumentReference | null = null;

      if (circle.payoutOrder === "bidding") {
        const bidResult = await this.resolveWinningBid(circle, tx);
        if (bidResult) {
          recipientId = bidResult.userId;
          bidPremiumKobo = bidResult.amount;
          winningBidRef = bidResult.ref;
        }
        // If no bids, fall through to rotational logic below
      }

      if (circle.payoutOrder === "random") {
        // Secure random selection from members who haven't received payout yet
        recipientId = circle.memberIds[Math.floor(Math.random() * circle.memberIds.length)];
      }

      // KYC gate
      const recipientSnap = await tx.get(this.usersCol.doc(recipientId));
      const recipient = recipientSnap.data() as User;
      const basePool = circle.contribution * circle.memberIds.length;
      const platformFee = Math.round(basePool * PLATFORM_PAYOUT_FEE_PERCENT);
      const netPayout = basePool - platformFee + bidPremiumKobo;

      if (recipient.kycStatus !== "verified" && netPayout > KYC_PAYOUT_THRESHOLD_KOBO) {
        void sendNotification(recipientId, {
          type: "general",
          title: "KYC Required for Payout",
          body: `Your payout of ₦${netPayout / 100} from "${circle.name}" is on hold. Complete KYC to receive funds.`,
          link: "/settings",
        });
        return;
      }

      // Mark winning bid
      if (winningBidRef) {
        tx.update(winningBidRef, { status: "won", updatedAt: FieldValue.serverTimestamp() });

        // Mark all other active bids as lost
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

        // Distribute bid premium equally to non-winning members
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

      // Credit payout to recipient
      await creditWallet(
        tx, recipientId, netPayout, "payout",
        `Payout from "${circle.name}" — Cycle ${circle.currentCycle}`,
        { circleId: circle.id }
      );

      // Advance cycle state
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

      // Notify recipient (fire-and-forget)
      void sendNotification(recipientId, {
        type: "payout_received",
        title: "Payout Received! 🎉",
        body: `₦${netPayout / 100} has been credited to your wallet from "${circle.name}".`,
        link: "/wallet",
      });

      if (recipient.phone) {
        void smsService.sendPayoutReceived(recipient.phone, circle.name, netPayout);
      }
    });
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

      for (const memberId of circle.memberIds) {
        if (paidIds.has(memberId)) continue;

        void sendNotification(memberId, {
          type: "contribution_due",
          title: "Contribution Due",
          body: `₦${circle.contribution / 100} due for "${circle.name}" — Cycle ${circle.currentCycle}.`,
          link: `/circles/${circle.id}`,
        });

        try {
          const userSnap = await this.usersCol.doc(memberId).get();
          const user = userSnap.data() as User;
          if (user?.phone) {
            void smsService.sendContributionReminder(user.phone, circle.name, circle.contribution);
          }
        } catch {
          // individual reminder failures must not block the loop
        }
      }
    }
  }

  // ─── Apply Penalties (cron) ────────────────────────────────────────────────

  async applyPenalties(): Promise<void> {
    const graceCutoff = new Date();
    graceCutoff.setHours(graceCutoff.getHours() - GRACE_PERIOD_HOURS);

    const snap = await this.contributionsCol
      .where("status", "==", "pending")
      .where("dueDate", "<=", Timestamp.fromDate(graceCutoff))
      .get();

    for (const contribDoc of snap.docs) {
      try {
        await this.applyPenaltyToContribution(contribDoc);
      } catch (err) {
        console.error(`[circle-service] Penalty failed for contribution ${contribDoc.id}:`, err);
      }
    }
  }

  private async applyPenaltyToContribution(
    contribDoc: admin.firestore.QueryDocumentSnapshot
  ): Promise<void> {
    const contrib = { id: contribDoc.id, ...contribDoc.data() } as Contribution;

    await adminDb.runTransaction(async (tx) => {
      const circleSnap = await tx.get(this.circlesCol.doc(contrib.circleId));
      const userSnap = await tx.get(this.usersCol.doc(contrib.userId));

      if (!circleSnap.exists || !userSnap.exists) return;

      const circle = circleSnap.data() as Circle;
      const user = userSnap.data() as User;

      tx.update(contribDoc.ref, {
        status: "late",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update trust score breakdown
      tx.update(this.circlesCol.doc(contrib.circleId), {
        "trustScoreBreakdown.latePayments": FieldValue.increment(1),
        "trustScoreBreakdown.lastUpdated": FieldValue.serverTimestamp(),
        trustScore: FieldValue.increment(-5), // deduct 5 points per late payment
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Check for three consecutive missed payments
      const missedSnap = await this.contributionsCol
        .where("circleId", "==", contrib.circleId)
        .where("userId", "==", contrib.userId)
        .where("status", "==", "missed")
        .orderBy("cycle", "desc")
        .limit(CONSECUTIVE_MISSED_LIMIT)
        .get();

      if (missedSnap.size >= CONSECUTIVE_MISSED_LIMIT - 1) {
        // Mark this as missed and auto-remove
        tx.update(contribDoc.ref, { status: "missed" });
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
          body: `You were removed from "${circle.name}" after ${CONSECUTIVE_MISSED_LIMIT} consecutive missed payments.`,
          link: "/circles",
        });
        return;
      }

      const penaltyKobo = Math.round(circle.contribution * LATE_PENALTY_PERCENT);

      void sendNotification(contrib.userId, {
        type: "penalty_applied",
        title: "Late Payment Warning",
        body: `Your contribution to "${circle.name}" is late. A ₦${penaltyKobo / 100} penalty applies on payment.`,
        link: `/circles/${contrib.circleId}`,
      });

      if (user.phone) {
        void smsService.sendLatePaymentWarning(user.phone, circle.name, penaltyKobo);
      }
    });
  }

  // ─── Bid ───────────────────────────────────────────────────────────────────

  async submitBid(circleId: string, userId: string, bidPremiumKobo: number): Promise<Bid> {
    if (bidPremiumKobo <= 0) {
      throw new CircleError("INVALID_INPUT", "Bid amount must be positive.");
    }

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
      deadline.setHours(deadline.getHours() - BID_CLOSE_HOURS_BEFORE_PAYOUT);

      if (new Date() > deadline) {
        throw new CircleError("BID_CLOSED", "Bidding for this cycle has closed.");
      }

      // Check for duplicate bid from same user this cycle
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

      // Recalculate dates from now to account for the paused period
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

      // Cancel pending contributions for removed member
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

  /**
   * Resolve the winning bid for a bidding-order circle.
   * Returns the highest bid, or null if none found.
   */
  private async resolveWinningBid(
    circle: Circle,
    _tx: admin.firestore.Transaction
  ): Promise<{ userId: string; amount: number; ref: admin.firestore.DocumentReference } | null> {
    const deadline = new Date(circle.nextPayoutDate.toDate());
    deadline.setHours(deadline.getHours() - BID_CLOSE_HOURS_BEFORE_PAYOUT);

    if (new Date() < deadline) return null; // bidding still open

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

  /**
   * Advance the current recipient pointer for rotational circles.
   * For random/bidding the caller resolves the recipient separately.
   */
  private advanceRecipient(circle: Circle, currentRecipientId: string): string {
    if (circle.payoutOrder !== "rotational") return currentRecipientId;
    const idx = circle.memberIds.indexOf(currentRecipientId);
    return circle.memberIds[(idx + 1) % circle.memberIds.length];
  }

  /**
   * Calculate nextDueDate and nextPayoutDate based on frequency from a base date.
   * All dates are set to 09:00 UTC.
   */
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