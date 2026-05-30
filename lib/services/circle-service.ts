import { adminDb, admin } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Circle, Contribution, User, Wallet, Bid, Transaction } from "@/lib/types";
import {
  MAX_ACTIVE_CIRCLES,
  // MIN_DEPOSIT_KOBO, // Not directly used here
  // MIN_WITHDRAW_KOBO, // Not directly used here
  // WITHDRAW_FEE_FLAT, // Not directly used here
  // WITHDRAW_FEE_PERCENT, // Not directly used here
} from "@/lib/constants";

// Placeholder for other services (assuming they exist and have these methods)
import * as paymentService from "@/lib/services/payment-service"; // Not directly used in this service, but good to acknowledge
import * as notificationService from "@/lib/services/notification-service";
import * as smsService from "@/lib/services/sms-service";

// CustomError utility (can be moved to a separate file like lib/utils/errors.ts)
class CustomError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "CustomError";
  }
}

export class CircleService {
  private circlesCollection = adminDb.collection("circles");
  private usersCollection = adminDb.collection("users");
  private walletsCollection = adminDb.collection("wallets");
  private contributionsCollection = adminDb.collection("contributions");
  private transactionsCollection = adminDb.collection("transactions");
  private bidsCollection = adminDb.collection("bids");

  /**
   * Calculates the next due and payout dates based on the circle's frequency.
   * Dates are set to 9 AM UTC.
   * @param frequency The circle's contribution frequency.
   * @param baseDate The date from which to calculate the next dates.
   * @param offset The number of frequency units to add (default 1 for next cycle).
   * @returns An object containing the nextDueDate and nextPayoutDate as Firestore Timestamps.
   */
  private calculateNextDates(
    frequency: Circle["frequency"],
    baseDate: Date,
    offset: number = 1
  ): { nextDueDate: Timestamp; nextPayoutDate: Timestamp } {
    const date = new Date(baseDate); // Create a mutable copy

    // Set to 9 AM UTC
    date.setUTCHours(9, 0, 0, 0);

    switch (frequency) {
      case "daily":
        date.setUTCDate(date.getUTCDate() + offset);
        break;
      case "weekly":
        date.setUTCDate(date.getUTCDate() + 7 * offset);
        break;
      case "bi-weekly":
        date.setUTCDate(date.getUTCDate() + 14 * offset);
        break;
      case "monthly":
        date.setUTCMonth(date.getUTCMonth() + offset);
        break;
      default:
        throw new CustomError("InvalidFrequency", "Invalid circle frequency.");
    }

    const nextDueDate = Timestamp.fromDate(date);
    const nextPayoutDate = nextDueDate; // For simplicity, payout on due date. Can be adjusted.

    return { nextDueDate, nextPayoutDate };
  }

  /**
   * Checks the KYC status of a user.
   * @param userId The ID of the user.
   * @returns The KYC status of the user.
   * @throws CustomError if user not found.
   */
  private async checkKycStatus(userId: string): Promise<User["kycStatus"]> {
    const userDoc = await this.usersCollection.doc(userId).get();
    if (!userDoc.exists) {
      throw new CustomError("NotFound", "User not found.");
    }
    return (userDoc.data() as User).kycStatus;
  }

  /**
   * Retrieves a user's wallet.
   * @param userId The ID of the user.
   * @returns The user's wallet.
   * @throws CustomError if wallet not found.
   */
  private async getUserWallet(userId: string): Promise<Wallet> {
    const walletDoc = await this.walletsCollection.doc(userId).get();
    if (!walletDoc.exists) {
      throw new CustomError("NotFound", "User wallet not found.");
    }
    return walletDoc.data() as Wallet;
  }

  /**
   * Updates a user's wallet balance and creates a transaction record within a Firestore transaction.
   * @param transaction The Firestore transaction object.
   * @param userId The ID of the user whose wallet is being updated.
   * @param amountKobo The amount in kobo to credit/debit.
   * @param type The type of transaction.
   * @param direction The direction of the transaction (credit/debit).
   * @param description A description for the transaction.
   * @param circleId Optional ID of the associated circle.
   * @param meta Optional metadata for the transaction.
   * @returns The ID of the newly created transaction.
   * @throws CustomError if wallet not found or insufficient funds.
   */
  private async updateWalletBalance(
    transaction: admin.firestore.Transaction,
    userId: string,
    amountKobo: number,
    type: Transaction["type"],
    direction: Transaction["direction"],
    description: string,
    circleId?: string,
    meta?: Record<string, unknown>
  ): Promise<string> {
    const walletRef = this.walletsCollection.doc(userId);
    const walletSnap = await transaction.get(walletRef);
    if (!walletSnap.exists) {
      throw new CustomError("NotFound", "Wallet not found for user.");
    }
    const wallet = walletSnap.data() as Wallet;

    let newAvailable = wallet.available;
    let newPending = wallet.pending; // Assuming pending is not directly affected by these ops
    let newTotalSaved = wallet.totalSaved;
    let newTotalReceived = wallet.totalReceived;
    let fee = 0; // Default fee

    if (direction === "credit") {
      newAvailable += amountKobo;
      if (type === "contribution") {
        newTotalSaved += amountKobo;
      } else if (type === "payout") {
        newTotalReceived += amountKobo;
      }
    } else {
      // debit
      if (newAvailable < amountKobo) {
        throw new CustomError("InsufficientFunds", "Insufficient funds in wallet.");
      }
      newAvailable -= amountKobo;
    }

    transaction.update(walletRef, {
      available: newAvailable,
      pending: newPending,
      totalSaved: newTotalSaved,
      totalReceived: newTotalReceived,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create transaction record
    const transactionRef = this.transactionsCollection.doc();
    const newTransaction: Omit<Transaction, "id"> = {
      userId,
      circleId,
      type,
      direction,
      amount: amountKobo,
      fee: fee, // Fee calculation might be more complex, placeholder for now
      netAmount: amountKobo - fee,
      status: "success",
      provider: undefined,
      providerReference: undefined,
      reference: transactionRef.id, // Internal reference
      description,
      meta,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.set(transactionRef, newTransaction);
    return transactionRef.id;
  }

  /**
   * Creates a new rotational savings circle.
   * @param adminId The ID of the user creating the circle.
   * @param name The name of the circle.
   * @param description The description of the circle.
   * @param maxMembers The maximum number of members allowed in the circle.
   * @param contribution The amount in kobo each member contributes per cycle.
   * @param frequency The frequency of contributions (daily, weekly, etc.).
   * @param payoutOrder The order in which members receive payouts.
   * @param isPrivate Whether the circle is private (requires invite code).
   * @param tags Tags associated with the circle.
   * @returns The newly created Circle object.
   * @throws CustomError for invalid input, KYC requirements, or insufficient funds.
   */
  public async createCircle(
    adminId: string,
    name: string,
    description: string,
    maxMembers: number,
    contribution: number, // in kobo
    frequency: Circle["frequency"],
    payoutOrder: Circle["payoutOrder"],
    isPrivate: boolean,
    tags: string[]
  ): Promise<Circle> {
    if (maxMembers <= 1) {
      throw new CustomError("InvalidInput", "Circle must have at least 2 members.");
    }
    if (contribution <= 0) {
      throw new CustomError("InvalidInput", "Contribution amount must be positive.");
    }

    const kycStatus = await this.checkKycStatus(adminId);
    if (kycStatus !== "verified") {
      throw new CustomError("KYCRequired", "Admin must be KYC verified to create a circle.");
    }

    const creationFee = Math.round(contribution * 0.05); // 5% of contribution amount

    return adminDb.runTransaction(async (transaction) => {
      const adminUserRef = this.usersCollection.doc(adminId);
      const adminUserSnap = await transaction.get(adminUserRef);
      if (!adminUserSnap.exists) {
        throw new CustomError("NotFound", "Admin user not found.");
      }
      const adminUser = adminUserSnap.data() as User;

      const adminWallet = await this.getUserWallet(adminId); // Get outside transaction for read-only check
      if (adminWallet.available < creationFee) {
        throw new CustomError("InsufficientFunds", "Insufficient funds for circle creation fee.");
      }

      // Deduct creation fee
      await this.updateWalletBalance(
        transaction,
        adminId,
        creationFee,
        "creation_fee",
        "debit",
        `Circle creation fee for ${name}`
      );

      const circleRef = this.circlesCollection.doc();
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase(); // Simple invite code

      const { nextDueDate, nextPayoutDate } = this.calculateNextDates(
        frequency,
        new Date()
      );

      const newCircle: Omit<Circle, "id" | "goal" | "trustScoreBreakdown"> = {
        name,
        description,
        adminId,
        memberIds: [adminId], // Admin is always turn position 1
        maxMembers,
        contribution,
        frequency,
        payoutOrder,
        status: "active",
        isPrivate,
        currentCycle: 1,
        totalCycles: maxMembers,
        nextDueDate,
        nextPayoutDate,
        currentRecipientId: adminId,
        trustScore: 100, // Initial trust score
        saved: 0,
        creationFee,
        tags,
        pendingRequestIds: [],
        inviteCode,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      transaction.set(circleRef, newCircle);

      // Add circleId to admin's user document
      transaction.update(adminUserRef, {
        circleIds: FieldValue.arrayUnion(circleRef.id),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Return the full circle object including derived fields
      return {
        id: circleRef.id,
        ...newCircle,
        goal: contribution * maxMembers,
        trustScoreBreakdown: {
          onTimePayments: 0,
          latePayments: 0,
          missedPayments: 0,
          lastUpdated: Timestamp.now(),
        },
      } as Circle;
    });
  }

  /**
   * Retrieves a circle by its ID.
   * @param circleId The ID of the circle.
   * @returns The Circle object or null if not found.
   */
  public async getCircleById(circleId: string): Promise<Circle | null> {
    const circleDoc = await this.circlesCollection.doc(circleId).get();
    if (!circleDoc.exists) {
      return null;
    }
    const circleData = circleDoc.data() as Circle;
    // Derive goal at read time
    return { ...circleData, goal: circleData.contribution * circleData.maxMembers };
  }

  /**
   * Allows a user to join an existing circle.
   * @param circleId The ID of the circle to join.
   * @param userId The ID of the user joining.
   * @param inviteCode Optional invite code for private circles.
   * @returns The updated Circle object.
   * @throws CustomError for various reasons (not found, already member, circle full, max circles reached, invalid invite code).
   */
  public async joinCircle(circleId: string, userId: string, inviteCode?: string): Promise<Circle> {
    return adminDb.runTransaction(async (transaction) => {
      const circleRef = this.circlesCollection.doc(circleId);
      const userRef = this.usersCollection.doc(userId);

      const [circleSnap, userSnap] = await transaction.getAll(circleRef, userRef);

      if (!circleSnap.exists) {
        throw new CustomError("NotFound", "Circle not found.");
      }
      if (!userSnap.exists) {
        throw new CustomError("NotFound", "User not found.");
      }

      const circle = circleSnap.data() as Circle;
      const user = userSnap.data() as User;

      if (circle.memberIds.includes(userId)) {
        throw new CustomError("AlreadyMember", "User is already a member of this circle.");
      }

      if (circle.memberIds.length >= circle.maxMembers) {
        throw new CustomError("CircleFull", "This circle is already full.");
      }

      if (user.circleIds.length >= MAX_ACTIVE_CIRCLES) {
        throw new CustomError("MaxCirclesReached", `You can only be in a maximum of ${MAX_ACTIVE_CIRCLES} active circles.`);
      }

      if (circle.isPrivate) {
        if (!inviteCode || circle.inviteCode !== inviteCode) {
          throw new CustomError("InvalidInviteCode", "Invalid or missing invite code for private circle.");
        }
        // If it was a pending request, remove it
        if (circle.pendingRequestIds.includes(userId)) {
          transaction.update(circleRef, {
            pendingRequestIds: FieldValue.arrayRemove(userId),
          });
        }
      } else {
        // For public circles, if there was a pending request, remove it
        if (circle.pendingRequestIds.includes(userId)) {
          transaction.update(circleRef, {
            pendingRequestIds: FieldValue.arrayRemove(userId),
          });
        }
      }

      // Add user to memberIds
      const updatedMemberIds = [...circle.memberIds, userId];
      transaction.update(circleRef, {
        memberIds: updatedMemberIds,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Add circleId to user's circleIds
      transaction.update(userRef, {
        circleIds: FieldValue.arrayUnion(circleId),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Notify circle admin and new member (non-transactional operations)
      await notificationService.sendNotification(circle.adminId, {
        type: "member_joined",
        title: "New Member Joined Your Circle",
        body: `${user.name} has joined your circle ${circle.name}.`,
        link: `/circles/${circleId}`,
      });
      await notificationService.sendNotification(userId, {
        type: "general",
        title: "Welcome to the Circle!",
        body: `You have successfully joined ${circle.name}.`,
        link: `/circles/${circleId}`,
      });

      return { ...circle, memberIds: updatedMemberIds, goal: circle.contribution * circle.maxMembers };
    });
  }

  /**
   * Records a contribution from a user to a circle.
   * @param circleId The ID of the circle.
   * @param userId The ID of the user making the contribution.
   * @param amountKobo The amount contributed in kobo.
   * @returns The updated Contribution object.
   * @throws CustomError for invalid input, not a member, circle inactive, invalid amount, or insufficient funds.
   */
  public async makeContribution(
    circleId: string,
    userId: string,
    amountKobo: number
  ): Promise<Contribution> {
    if (amountKobo <= 0) {
      throw new CustomError("InvalidInput", "Contribution amount must be positive.");
    }

    return adminDb.runTransaction(async (transaction) => {
      const circleRef = this.circlesCollection.doc(circleId);
      const userRef = this.usersCollection.doc(userId);
      const walletRef = this.walletsCollection.doc(userId);

      const [circleSnap, userSnap, walletSnap] = await transaction.getAll(
        circleRef,
        userRef,
        walletRef
      );

      if (!circleSnap.exists) {
        throw new CustomError("NotFound", "Circle not found.");
      }
      if (!userSnap.exists) {
        throw new CustomError("NotFound", "User not found.");
      }
      if (!walletSnap.exists) {
        throw new CustomError("NotFound", "User wallet not found.");
      }

      const circle = circleSnap.data() as Circle;
      const user = userSnap.data() as User;
      const wallet = walletSnap.data() as Wallet;

      if (!circle.memberIds.includes(userId)) {
        throw new CustomError("NotMember", "User is not a member of this circle.");
      }

      if (circle.status !== "active") {
        throw new CustomError("CircleInactive", "This circle is not active for contributions.");
      }

      if (amountKobo !== circle.contribution) {
        throw new CustomError("InvalidAmount", `Contribution amount must be ${circle.contribution / 100} NGN.`);
      }

      // Find the current contribution for this user and cycle
      const contributionsSnap = await transaction.get(
        this.contributionsCollection
          .where("circleId", "==", circleId)
          .where("userId", "==", userId)
          .where("cycle", "==", circle.currentCycle)
          .limit(1)
      );

      let contributionDoc: Contribution;
      let contributionRef: admin.firestore.DocumentReference<admin.firestore.DocumentData>;

      if (contributionsSnap.empty) {
        // Create new contribution if not exists (e.g., first time for this cycle)
        contributionRef = this.contributionsCollection.doc();
        contributionDoc = {
          id: contributionRef.id,
          circleId,
          userId,
          cycle: circle.currentCycle,
          amount: amountKobo,
          status: "pending", // Will be updated to 'paid' below
          dueDate: circle.nextDueDate,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        } as Contribution;
        transaction.set(contributionRef, contributionDoc);
      } else {
        contributionRef = contributionsSnap.docs[0].ref;
        contributionDoc = contributionsSnap.docs[0].data() as Contribution;
      }

      if (contributionDoc.status === "paid") {
        throw new CustomError("AlreadyPaid", "Contribution for this cycle already paid.");
      }

      let totalAmountToDeduct = amountKobo;
      let penaltyAmount = 0;

      // Check if the contribution is late and penalty hasn't been paid
      if (contributionDoc.status === "late" && !contributionDoc.penaltyPaid) {
        penaltyAmount = Math.round(circle.contribution * 0.10); // 10% penalty
        totalAmountToDeduct += penaltyAmount;
      }

      if (wallet.available < totalAmountToDeduct) {
        throw new CustomError("InsufficientFunds", "Insufficient funds in wallet for contribution and potential penalty.");
      }

      // Deduct from wallet for contribution
      const contributionTransactionId = await this.updateWalletBalance(
        transaction,
        userId,
        amountKobo,
        "contribution",
        "debit",
        `Contribution to ${circle.name} (Cycle ${circle.currentCycle})`,
        circle.id
      );

      // Update contribution status
      const updatedContribution: Partial<Contribution> = {
        status: "paid",
        paidAt: FieldValue.serverTimestamp() as Timestamp,
        transactionId: contributionTransactionId,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (penaltyAmount > 0) {
        updatedContribution.penaltyAmount = penaltyAmount;
        updatedContribution.penaltyPaid = true;
        // Record penalty transaction (deducting from wallet)
        await this.updateWalletBalance(
          transaction,
          userId,
          penaltyAmount,
          "penalty",
          "debit",
          `Penalty for late contribution to ${circle.name} (Cycle ${circle.currentCycle})`,
          circle.id
        );
      }
      transaction.update(contributionRef, updatedContribution);

      // Update circle's saved amount and trust score (simplified for now)
      transaction.update(circleRef, {
        saved: FieldValue.increment(amountKobo),
        // Logic for trustScoreBreakdown update would go here (e.g., increment onTimePayments)
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Notify user of successful contribution (non-transactional)
      await notificationService.sendNotification(userId, {
        type: "general", // Or 'contribution_received'
        title: "Contribution Successful",
        body: `Your contribution of ${amountKobo / 100} NGN to ${circle.name} (Cycle ${circle.currentCycle}) was successful.`,
        link: `/circles/${circleId}`,
      });

      return { ...contributionDoc, ...updatedContribution } as Contribution;
    });
  }

  /**
   * Processes payouts for circles where `nextPayoutDate` has passed.
   * This method is intended to be called by a cron job.
   */
  public async processPayouts(): Promise<void> {
    const now = Timestamp.now();
    const circlesToPayoutSnap = await this.circlesCollection
      .where("nextPayoutDate", "<=", now)
      .where("status", "==", "active")
      .get();

    for (const circleDoc of circlesToPayoutSnap.docs) {
      const circle = circleDoc.data() as Circle;

      // Fetch all contributions for the current cycle to determine who has paid
      const currentCycleContributionsSnap = await this.contributionsCollection
        .where("circleId", "==", circle.id)
        .where("cycle", "==", circle.currentCycle)
        .get();

      const paidMemberIdsForCycle = new Set(
        currentCycleContributionsSnap.docs
          .filter((doc) => (doc.data() as Contribution).status === "paid")
          .map((doc) => (doc.data() as Contribution).userId)
      );

      // Rule: A circle can only start payouts when all member slots are filled.
      // This implies that `memberIds.length` should be equal to `maxMembers` before first payout.
      // For subsequent payouts, it implies all members must have paid for the current cycle.
      if (paidMemberIdsForCycle.size < circle.memberIds.length) {
        console.warn(`Circle ${circle.id} (Cycle ${circle.currentCycle}): Not all members have contributed. Skipping payout.`);
        // In a real system, more complex logic would be here:
        // - Apply penalties for late members (handled by applyPenalties cron)
        // - Potentially pause the circle if too many missed payments
        // - Allow payout with fewer funds if rules permit (not in current spec)
        continue; // Skip this circle for now
      }

      await adminDb.runTransaction(async (transaction) => {
        const circleRef = this.circlesCollection.doc(circle.id);
        let currentRecipientId = circle.currentRecipientId;

        if (!currentRecipientId) {
          console.error(`Circle ${circle.id}: No current recipient set for payout. This should not happen.`);
          return;
        }

        const recipientKycStatus = await this.checkKycStatus(currentRecipientId);
        const payoutAmount = circle.contribution * circle.memberIds.length; // Total pool
        const platformFee = Math.round(payoutAmount * 0.01); // 1% platform fee
        let netPayout = payoutAmount - platformFee;

        // KYC gate for payouts
        if (recipientKycStatus !== "verified" && netPayout > 5_000_000) { // ₦50,000 in kobo
          console.warn(`Circle ${circle.id}: Recipient ${currentRecipientId} not KYC verified for payout > ₦50,000. Deferring payout.`);
          // Defer payout: do not update circle's nextPayoutDate, it will be re-evaluated next run.
          // Notify user to complete KYC.
          await notificationService.sendNotification(currentRecipientId, {
            type: "general",
            title: "Action Required: KYC for Payout",
            body: `Your payout of ${netPayout / 100} NGN from ${circle.name} is on hold. Please complete KYC verification to receive your funds.`,
            link: `/settings`, // Link to KYC settings
          });
          return; // Skip this payout for now
        }

        // Handle bidding order specific logic
        let bidPremium = 0;
        if (circle.payoutOrder === "bidding") {
          const activeBidSnap = await this.bidsCollection
            .where("circleId", "==", circle.id)
            .where("cycle", "==", circle.currentCycle)
            .where("status", "==", "active")
            .orderBy("amount", "desc")
            .limit(1)
            .get();

          if (!activeBidSnap.empty) {
            const winningBid = activeBidSnap.docs[0].data() as Bid;
            currentRecipientId = winningBid.userId; // Winner of bid gets payout
            bidPremium = winningBid.amount;
            netPayout += bidPremium; // Add bid premium to payout for the winner

            // Mark bid as won
            transaction.update(activeBidSnap.docs[0].ref, { status: "won", updatedAt: FieldValue.serverTimestamp() });

            // Distribute bid premium to non-winning members
            // This is a complex rule: "bid premium goes to the pool (distributed equally to non-winning members)"
            // This would require crediting individual wallets of (circle.memberIds.length - 1) members.
            // For now, let's log and acknowledge this needs detailed implementation.
            console.log(`Bid premium of ${bidPremium / 100} NGN won by ${winningBid.userId}. Distribution to non-winners needs implementation.`);
            // Example:
            // const nonWinningMembers = circle.memberIds.filter(id => id !== winningBid.userId);
            // const sharePerMember = bidPremium / nonWinningMembers.length;
            // for (const memberId of nonWinningMembers) {
            //   await this.updateWalletBalance(transaction, memberId, sharePerMember, "referral_bonus", "credit", `Bid premium share from ${circle.name}`);
            // }
          } else {
            // Fallback to rotational if no bids or bids not resolved
            console.log(`Circle ${circle.id}: No winning bid found for cycle ${circle.currentCycle}. Falling back to rotational payout.`);
            const currentRecipientIndex = circle.memberIds.indexOf(circle.currentRecipientId);
            currentRecipientId = circle.memberIds[(currentRecipientIndex + 1) % circle.memberIds.length];
          }
        }

        // Credit recipient's wallet
        await this.updateWalletBalance(
          transaction,
          currentRecipientId,
          netPayout,
          "payout",
          "credit",
          `Payout from ${circle.name} (Cycle ${circle.currentCycle})`,
          circle.id
        );

        // Update circle state for next cycle
        const nextCycle = circle.currentCycle + 1;
        let nextRecipientId = currentRecipientId; // Default to current, then advance
        let newCircleStatus = circle.status;

        if (nextCycle > circle.totalCycles) {
          // Circle completed
          newCircleStatus = "completed";
          nextRecipientId = ""; // No more recipients
        } else {
          // Determine next recipient based on payout order
          if (circle.payoutOrder === "rotational") {
            const currentRecipientIndex = circle.memberIds.indexOf(currentRecipientId);
            nextRecipientId = circle.memberIds[(currentRecipientIndex + 1) % circle.memberIds.length];
          } else if (circle.payoutOrder === "random") {
            // Ensure random recipient hasn't received payout in this totalCycles period
            // This requires tracking payout history, which is not in current model.
            // For now, a simple random pick from all members.
            nextRecipientId = circle.memberIds[Math.floor(Math.random() * circle.memberIds.length)];
          }
          // Bidding order recipient is already determined above
        }

        const { nextDueDate, nextPayoutDate } = this.calculateNextDates(
          circle.frequency,
          now.toDate() // Calculate next dates from current time
        );

        transaction.update(circleRef, {
          currentCycle: nextCycle,
          nextDueDate: nextDueDate,
          nextPayoutDate: nextPayoutDate,
          currentRecipientId: nextRecipientId,
          status: newCircleStatus,
          saved: 0, // Reset saved for the new cycle
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Notify recipient (non-transactional)
        await notificationService.sendNotification(currentRecipientId, {
          type: "payout_received",
          title: "Payout Received!",
          body: `You received ${netPayout / 100} NGN from ${circle.name}.`,
          link: `/wallet`,
        });

        // Send SMS for time-sensitive alerts (non-transactional)
        const recipientUserSnap = await transaction.get(this.usersCollection.doc(currentRecipientId));
        if (recipientUserSnap.exists) {
          const recipientUser = recipientUserSnap.data() as User;
          if (recipientUser.phone) {
            await smsService.sendSms(recipientUser.phone, `AjoSave: You received ${netPayout / 100} NGN from ${circle.name}. Check your wallet.`);
          }
        }
      });
    }
  }

  /**
   * Sends contribution reminders to members whose payments are due.
   * This method is intended to be called by a cron job.
   */
  public async sendContributionReminders(): Promise<void> {
    const now = Timestamp.now();
    const circlesToRemindSnap = await this.circlesCollection
      .where("nextDueDate", "<=", now)
      .where("status", "==", "active")
      .get();

    for (const circleDoc of circlesToRemindSnap.docs) {
      const circle = circleDoc.data() as Circle;

      // Get members who haven't paid for the current cycle
      const currentCycleContributionsSnap = await this.contributionsCollection
        .where("circleId", "==", circle.id)
        .where("cycle", "==", circle.currentCycle)
        .get();

      const paidMemberIds = new Set(
        currentCycleContributionsSnap.docs
          .filter((doc) => (doc.data() as Contribution).status === "paid")
          .map((doc) => (doc.data() as Contribution).userId)
      );

      const unpaidMemberIds = circle.memberIds.filter(
        (memberId) => !paidMemberIds.has(memberId)
      );

      for (const userId of unpaidMemberIds) {
        const userDoc = await this.usersCollection.doc(userId).get();
        if (userDoc.exists) {
          const user = userDoc.data() as User;
          // Send reminder notification
          await notificationService.sendNotification(userId, {
            type: "contribution_due",
            title: "Contribution Due Soon!",
            body: `Your contribution of ${circle.contribution / 100} NGN for ${circle.name} (Cycle ${circle.currentCycle}) is due.`,
            link: `/circles/${circle.id}`,
          });

          // Send SMS reminder (primary channel)
          if (user.phone) {
            await smsService.sendSms(user.phone, `AjoSave: Your contribution of ${circle.contribution / 100} NGN for ${circle.name} is due. Please pay now.`);
          }
        }
      }
    }
  }

  /**
   * Applies penalties for late contributions.
   * This method is intended to be called by a cron job.
   */
  public async applyPenalties(): Promise<void> {
    const now = Timestamp.now();
    const gracePeriodEnd = new Date(now.toDate());
    gracePeriodEnd.setUTCHours(gracePeriodEnd.getUTCHours() - 48); // 48 hours grace period

    const lateContributionsSnap = await this.contributionsCollection
      .where("status", "==", "pending")
      .where("dueDate", "<=", Timestamp.fromDate(gracePeriodEnd))
      .get();

    for (const contributionDoc of lateContributionsSnap.docs) {
      const contribution = contributionDoc.data() as Contribution;
      const circleRef = this.circlesCollection.doc(contribution.circleId);
      const userRef = this.usersCollection.doc(contribution.userId);

      await adminDb.runTransaction(async (transaction) => {
        const circleSnap = await transaction.get(circleRef);
        const userSnap = await transaction.get(userRef);

        if (!circleSnap.exists || !userSnap.exists) {
          console.warn(`Skipping penalty for contribution ${contribution.id}: Circle or User not found.`);
          return;
        }

        const circle = circleSnap.data() as Circle;
        const user = userSnap.data() as User;

        // Update contribution status to 'late'
        transaction.update(contributionDoc.ref, {
          status: "late",
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Update trust score breakdown (increment latePayments)
        const currentTrustScoreBreakdown = circle.trustScoreBreakdown || {
          onTimePayments: 0,
          latePayments: 0,
          missedPayments: 0,
          lastUpdated: Timestamp.now(),
        };
        currentTrustScoreBreakdown.latePayments += 1;
        currentTrustScoreBreakdown.lastUpdated = FieldValue.serverTimestamp() as Timestamp;

        transaction.update(circleRef, {
          trustScoreBreakdown: currentTrustScoreBreakdown,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Notify user of late payment and penalty (non-transactional)
        const penaltyAmount = Math.round(circle.contribution * 0.10); // 10% penalty
        await notificationService.sendNotification(contribution.userId, {
          type: "penalty_applied",
          title: "Late Contribution & Penalty",
          body: `Your contribution to ${circle.name} (Cycle ${contribution.cycle}) is late. A penalty of ${penaltyAmount / 100} NGN will be applied on payment.`,
          link: `/circles/${circle.id}`,
        });

        if (user.phone) {
          await smsService.sendSms(user.phone, `AjoSave: Your contribution to ${circle.name} is late. A penalty of ${penaltyAmount / 100} NGN will be applied.`);
        }

        // TODO: Implement logic for three consecutive missed payments = automatic removal from circle
        // This would involve querying past contributions for the user in this circle and checking their status.
        // If 3 consecutive missed payments, then:
        // 1. Remove user from circle.memberIds
        // 2. Remove circleId from user.circleIds
        // 3. Mark all future contributions for this user in this circle as 'cancelled'
        // 4. Notify user and admin
      });
    }
  }

  /**
   * Allows a user to submit a bid for the next payout in a bidding-order circle.
   * @param circleId The ID of the circle.
   * @param userId The ID of the user submitting the bid.
   * @param amountKobo The bid premium amount in kobo.
   * @returns The newly created Bid object.
   * @throws CustomError for invalid input, not a bidding circle, not a member, already received payout, or bid deadline passed.
   */
  public async submitBid(
    circleId: string,
    userId: string,
    amountKobo: number // Bid premium
  ): Promise<Bid> {
    if (amountKobo <= 0) {
      throw new CustomError("InvalidInput", "Bid amount must be positive.");
    }

    return adminDb.runTransaction(async (transaction) => {
      const circleRef = this.circlesCollection.doc(circleId);
      const circleSnap = await transaction.get(circleRef);

      if (!circleSnap.exists) {
        throw new CustomError("NotFound", "Circle not found.");
      }
      const circle = circleSnap.data() as Circle;

      if (circle.payoutOrder !== "bidding") {
        throw new CustomError("InvalidOperation", "Bidding is only allowed for bidding-order circles.");
      }

      if (!circle.memberIds.includes(userId)) {
        throw new CustomError("NotMember", "User is not a member of this circle.");
      }

      // Check if user has already received payout for this cycle (or is the current recipient)
      if (circle.currentRecipientId === userId) {
        throw new CustomError("AlreadyReceivedPayout", "You are the current recipient and cannot bid for this cycle.");
      }

      // Check bid deadline (24 hours before nextPayoutDate)
      const bidDeadline = new Date(circle.nextPayoutDate.toDate());
      bidDeadline.setUTCHours(bidDeadline.getUTCHours() - 24); // 24 hours before payout date
      if (Timestamp.now().toDate() > bidDeadline) {
        throw new CustomError("BidDeadlinePassed", "Bidding for this cycle has closed.");
      }

      const bidRef = this.bidsCollection.doc();
      const newBid: Omit<Bid, "id"> = {
        circleId,
        cycle: circle.currentCycle,
        userId,
        amount: amountKobo,
        status: "active",
        deadline: Timestamp.fromDate(bidDeadline),
        createdAt: FieldValue.serverTimestamp(),
      };
      transaction.set(bidRef, newBid);

      // Notify admin about new bid (non-transactional)
      // Need to fetch user name for notification, which is outside transaction or requires another read
      // For simplicity, assuming user is already fetched or notification service can handle userId
      await notificationService.sendNotification(circle.adminId, {
        type: "general",
        title: "New Bid Submitted",
        body: `A user submitted a bid of ${amountKobo / 100} NGN for ${circle.name} (Cycle ${circle.currentCycle}).`,
        link: `/circles/${circleId}`,
      });

      return { id: bidRef.id, ...newBid } as Bid;
    });
  }

  /**
   * Pauses an active circle. Only the circle admin can perform this action.
   * @param circleId The ID of the circle to pause.
   * @param adminId The ID of the admin user.
   * @returns The updated Circle object.
   * @throws CustomError if circle not found, unauthorized, or already paused.
   */
  public async pauseCircle(circleId: string, adminId: string): Promise<Circle> {
    return adminDb.runTransaction(async (transaction) => {
      const circleRef = this.circlesCollection.doc(circleId);
      const circleSnap = await transaction.get(circleRef);

      if (!circleSnap.exists) {
        throw new CustomError("NotFound", "Circle not found.");
      }
      const circle = circleSnap.data() as Circle;

      if (circle.adminId !== adminId) {
        throw new CustomError("Unauthorized", "Only the circle admin can pause the circle.");
      }

      if (circle.status === "paused") {
        throw new CustomError("InvalidOperation", "Circle is already paused.");
      }

      transaction.update(circleRef, {
        status: "paused",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Notify all members of the circle (non-transactional)
      for (const memberId of circle.memberIds) {
        await notificationService.sendNotification(memberId, {
          type: "general",
          title: "Circle Paused",
          body: `The circle ${circle.name} has been paused by the admin. Contributions and payouts are temporarily suspended.`,
          link: `/circles/${circleId}`,
        });
      }

      return { ...circle, status: "paused" };
    });
  }

  /**
   * Unpauses a paused circle. Only the circle admin can perform this action.
   * Recalculates `nextDueDate` and `nextPayoutDate` from the current time.
   * @param circleId The ID of the circle to unpause.
   * @param adminId The ID of the admin user.
   * @returns The updated Circle object.
   * @throws CustomError if circle not found, unauthorized, or not paused.
   */
  public async unpauseCircle(circleId: string, adminId: string): Promise<Circle> {
    return adminDb.runTransaction(async (transaction) => {
      const circleRef = this.circlesCollection.doc(circleId);
      const circleSnap = await transaction.get(circleRef);

      if (!circleSnap.exists) {
        throw new CustomError("NotFound", "Circle not found.");
      }
      const circle = circleSnap.data() as Circle;

      if (circle.adminId !== adminId) {
        throw new CustomError("Unauthorized", "Only the circle admin can unpause the circle.");
      }

      if (circle.status !== "paused") {
        throw new CustomError("InvalidOperation", "Circle is not paused.");
      }

      // When unpausing, recalculate next due/payout dates from now
      const { nextDueDate, nextPayoutDate } = this.calculateNextDates(
        circle.frequency,
        new Date()
      );

      transaction.update(circleRef, {
        status: "active",
        nextDueDate,
        nextPayoutDate,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Notify all members of the circle (non-transactional)
      for (const memberId of circle.memberIds) {
        await notificationService.sendNotification(memberId, {
          type: "general",
          title: "Circle Unpaused",
          body: `The circle ${circle.name} has been unpaused by the admin. Contributions and payouts will resume.`,
          link: `/circles/${circleId}`,
        });
      }

      return { ...circle, status: "active", nextDueDate, nextPayoutDate };
    });
  }

  /**
   * Removes a member from a circle. Only the circle admin can perform this action.
   * Cancels any pending contributions for the removed member in that circle.
   * @param circleId The ID of the circle.
   * @param memberId The ID of the member to remove.
   * @param adminId The ID of the admin user performing the removal.
   * @returns The updated Circle object.
   * @throws CustomError if circle/member not found, unauthorized, or trying to remove admin.
   */
  public async removeMember(circleId: string, memberId: string, adminId: string): Promise<Circle> {
    return adminDb.runTransaction(async (transaction) => {
      const circleRef = this.circlesCollection.doc(circleId);
      const memberUserRef = this.usersCollection.doc(memberId);

      const [circleSnap, memberUserSnap] = await transaction.getAll(circleRef, memberUserRef);

      if (!circleSnap.exists) {
        throw new CustomError("NotFound", "Circle not found.");
      }
      if (!memberUserSnap.exists) {
        throw new CustomError("NotFound", "Member user not found.");
      }

      const circle = circleSnap.data() as Circle;
      const memberUser = memberUserSnap.data() as User;

      if (circle.adminId !== adminId) {
        throw new CustomError("Unauthorized", "Only the circle admin can remove members.");
      }

      if (memberId === adminId) {
        throw new CustomError("InvalidOperation", "Admin cannot remove themselves from the circle.");
      }

      if (!circle.memberIds.includes(memberId)) {
        throw new CustomError("NotMember", "User is not a member of this circle.");
      }

      // Remove member from circle's memberIds
      const updatedMemberIds = circle.memberIds.filter((id) => id !== memberId);
      transaction.update(circleRef, {
        memberIds: updatedMemberIds,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Remove circleId from member's user document
      transaction.update(memberUserRef, {
        circleIds: FieldValue.arrayRemove(circleId),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Cancel pending contributions for this member in this circle
      const pendingContributionsSnap = await transaction.get(
        this.contributionsCollection
          .where("circleId", "==", circleId)
          .where("userId", "==", memberId)
          .where("status", "==", "pending")
      );

      for (const doc of pendingContributionsSnap.docs) {
        transaction.update(doc.ref, {
          status: "cancelled",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Notify removed member and admin (non-transactional)
      await notificationService.sendNotification(memberId, {
        type: "general",
        title: "Removed from Circle",
        body: `You have been removed from ${circle.name}.`,
        link: `/dashboard`,
      });
      await notificationService.sendNotification(adminId, {
        type: "general",
        title: "Member Removed",
        body: `${memberUser.name} has been removed from ${circle.name}.`,
        link: `/circles/${circleId}`,
      });

      return { ...circle, memberIds: updatedMemberIds };
    });
  }
}