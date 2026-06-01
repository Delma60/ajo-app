import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendNotification } from "@/lib/services/notification-service";
import * as emailSender from "@/lib/email/senders";
import type {
  SupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/lib/types/support";
import type { User } from "@/lib/types/user";

export class SupportError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "UNAUTHORIZED"
      | "INVALID_INPUT"
      | "FORBIDDEN",
    message: string
  ) {
    super(message);
    this.name = "SupportError";
  }
}

const VALID_STATUS_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  open: ["in_progress", "waiting_on_user", "resolved", "closed"],
  in_progress: ["waiting_on_user", "resolved", "closed"],
  waiting_on_user: ["open", "in_progress", "resolved", "closed"],
  resolved: ["closed"],
  closed: [],
};

export class SupportService {
  private readonly tickets = adminDb.collection("support_tickets");
  private readonly users = adminDb.collection("users");

  async createTicket(input: {
    userId: string;
    subject: string;
    category: SupportTicketCategory;
    priority: SupportTicketPriority;
    initialMessage: string;
    screenshotUrl?: string;
  }): Promise<SupportTicket> {
    if (!input.subject.trim()) {
      throw new SupportError("INVALID_INPUT", "Subject is required.");
    }

    if (!input.initialMessage.trim()) {
      throw new SupportError("INVALID_INPUT", "Message is required.");
    }

    const now = FieldValue.serverTimestamp();
    const ticketRef = this.tickets.doc();

    const ticketData = {
      userId: input.userId,
      subject: input.subject.trim(),
      category: input.category,
      priority: input.priority,
      status: "open" as SupportTicketStatus,
      assignedTo: null,
      screenshotUrl: input.screenshotUrl ?? null,
      lastMessageAt: now as any,
      createdAt: now as any,
      updatedAt: now as any,
    };

    await ticketRef.set(ticketData);

    const messageRef = ticketRef.collection("messages").doc();
    await messageRef.set({
      id: messageRef.id,
      ticketId: ticketRef.id,
      senderId: input.userId,
      senderRole: "user",
      text: input.initialMessage.trim(),
      createdAt: now as any,
      isInternal: false,
      attachmentUrl: input.screenshotUrl ?? null,
    });

    await this.notifyAdmins({
      type: "general",
      title: "New support ticket submitted",
      body: `${input.subject} — a new support ticket needs review.`,
      link: `/admin/support`,
    });

    const userSnap = await this.users.doc(input.userId).get();
    const user = userSnap.exists ? (userSnap.data() as User) : null;
    if (user) {
      await sendNotification(user.id, {
        type: "general",
        title: "Support ticket created",
        body: `We received your request: "${input.subject}". Our team will respond soon.",
        link: `/support/${ticketRef.id}`,
      });

      void emailSender.sendSupportTicketConfirmationEmail(user.email, {
        name: user.name,
        subject: input.subject,
        ticketId: ticketRef.id,
        category: input.category,
        priority: input.priority,
      });
    }

    return {
      id: ticketRef.id,
      ...ticketData,
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as SupportTicket;
  }

  async addMessage(input: {
    ticketId: string;
    senderId: string;
    senderRole: "user" | "agent";
    text: string;
    isInternal?: boolean;
    attachmentUrl?: string;
  }): Promise<void> {
    if (!input.text.trim()) {
      throw new SupportError("INVALID_INPUT", "Message text cannot be empty.");
    }

    const ticketRef = this.tickets.doc(input.ticketId);
    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) {
      throw new SupportError("NOT_FOUND", "Support ticket not found.");
    }

    const ticket = ticketSnap.data()!;
    if (input.senderRole === "user" && ticket.userId !== input.senderId) {
      throw new SupportError("FORBIDDEN", "You do not have access to send messages on this ticket.");
    }

    const now = FieldValue.serverTimestamp();
    const messageRef = ticketRef.collection("messages").doc();

    await messageRef.set({
      id: messageRef.id,
      ticketId: input.ticketId,
      senderId: input.senderId,
      senderRole: input.senderRole,
      text: input.text.trim(),
      createdAt: now as any,
      isInternal: input.isInternal ?? false,
      attachmentUrl: input.attachmentUrl ?? null,
    });

    await ticketRef.update({
      updatedAt: now as any,
      lastMessageAt: now as any,
      status:
        input.senderRole === "user" && ticket.status !== "resolved"
          ? "open"
          : ticket.status,
    });
  }

  async getTicket(ticketId: string, requestingUserId: string): Promise<SupportTicket> {
    const ticketSnap = await this.tickets.doc(ticketId).get();
    if (!ticketSnap.exists) {
      throw new SupportError("NOT_FOUND", "Support ticket not found.");
    }

    const ticket = { id: ticketSnap.id, ...ticketSnap.data() } as SupportTicket;
    const userSnap = await this.users.doc(requestingUserId).get();
    const user = userSnap.exists ? (userSnap.data() as User) : null;
    const isAdmin = user?.role === "admin";

    if (!isAdmin && ticket.userId !== requestingUserId) {
      throw new SupportError("FORBIDDEN", "You do not have access to this ticket.");
    }

    return this.normalizeTicket(ticketSnap.id, ticket);
  }

  async listTicketsForUser(userId: string): Promise<SupportTicket[]> {
    const snap = await this.tickets
      .where("userId", "==", userId)
      .orderBy("lastMessageAt", "desc")
      .get();

    return snap.docs.map((doc) => this.normalizeTicket(doc.id, { ...doc.data() } as SupportTicket));
  }

  async listAdminTickets(options: {
    status?: SupportTicketStatus;
    category?: SupportTicketCategory;
    assignedTo?: string;
    search?: string;
    limit?: number;
  }): Promise<SupportTicket[]> {
    let q: FirebaseFirestore.Query = this.tickets;

    if (options.status) q = q.where("status", "==", options.status);
    if (options.category) q = q.where("category", "==", options.category);
    if (options.assignedTo) q = q.where("assignedTo", "==", options.assignedTo);

    q = q.orderBy("lastMessageAt", "desc");
    if (options.limit) q = q.limit(options.limit);

    const snap = await q.get();
    let tickets = snap.docs.map((doc) => this.normalizeTicket(doc.id, { ...doc.data() } as SupportTicket));

    if (options.search) {
      const query = options.search.toLowerCase();
      tickets = tickets.filter((ticket) =>
        ticket.subject.toLowerCase().includes(query) ||
          ticket.category.toLowerCase().includes(query) ||
          ticket.status.toLowerCase().includes(query)
      );
    }

    return tickets;
  }

  async updateTicket(
    ticketId: string,
    adminId: string,
    updates: {
      status?: SupportTicketStatus;
      priority?: SupportTicketPriority;
      assignedTo?: string | null;
    }
  ): Promise<SupportTicket> {
    const adminSnap = await this.users.doc(adminId).get();
    if (!adminSnap.exists || (adminSnap.data() as User).role !== "admin") {
      throw new SupportError("UNAUTHORIZED", "Only admins may update tickets.");
    }

    const ticketRef = this.tickets.doc(ticketId);
    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) {
      throw new SupportError("NOT_FOUND", "Support ticket not found.");
    }

    const ticket = { id: ticketSnap.id, ...ticketSnap.data() } as SupportTicket;
    const updatePayload: Record<string, unknown> = {};

    if (updates.status && updates.status !== ticket.status) {
      const allowed = VALID_STATUS_TRANSITIONS[ticket.status];
      if (!allowed.includes(updates.status)) {
        throw new SupportError(
          "INVALID_INPUT",
          `Cannot transition ticket from ${ticket.status} to ${updates.status}.`
        );
      }
      updatePayload.status = updates.status;
    }

    if (updates.priority && updates.priority !== ticket.priority) {
      updatePayload.priority = updates.priority;
    }

    if (updates.assignedTo !== undefined) {
      updatePayload.assignedTo = updates.assignedTo || null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return this.normalizeTicket(ticketSnap.id, ticket);
    }

    updatePayload.updatedAt = FieldValue.serverTimestamp();
    await ticketRef.update(updatePayload);

    if (updates.status && updates.status !== ticket.status) {
      await this.notifyTicketOwner(ticket.userId, ticket.id, ticket.subject, updates.status);
    }

    const updatedSnap = await ticketRef.get();
    return this.normalizeTicket(updatedSnap.id, { ...updatedSnap.data() } as SupportTicket);
  }

  async getAdminStats(): Promise<{
    totalOpen: number;
    totalInProgress: number;
    totalWaitingOnUser: number;
    totalResolved: number;
    unassigned: number;
  }> {
    const [openSnap, inProgressSnap, waitingSnap, resolvedSnap, unassignedSnap] =
      await Promise.all([
        this.tickets.where("status", "==", "open").get(),
        this.tickets.where("status", "==", "in_progress").get(),
        this.tickets.where("status", "==", "waiting_on_user").get(),
        this.tickets.where("status", "==", "resolved").get(),
        this.tickets.where("assignedTo", "==", null).get(),
      ]);

    return {
      totalOpen: openSnap.size,
      totalInProgress: inProgressSnap.size,
      totalWaitingOnUser: waitingSnap.size,
      totalResolved: resolvedSnap.size,
      unassigned: unassignedSnap.size,
    };
  }

  private async notifyAdmins(notification: {
    type: Parameters<typeof sendNotification>[1]["type"];
    title: string;
    body: string;
    link: string;
  }): Promise<void> {
    try {
      const adminSnaps = await this.users.where("role", "==", "admin").get();
      const tasks = adminSnaps.docs.map((adminDoc) =>
        sendNotification(adminDoc.id, notification)
      );
      await Promise.allSettled(tasks);
    } catch (err) {
      console.error("[support-service] notifyAdmins failed:", err);
    }
  }

  private async notifyTicketOwner(
    userId: string,
    ticketId: string,
    subject: string,
    status: SupportTicketStatus
  ): Promise<void> {
    const notificationMap: Record<SupportTicketStatus, string> = {
      open: "Your support ticket is open.",
      in_progress: "A support agent is reviewing your ticket.",
      waiting_on_user: "Your support ticket needs more information from you.",
      resolved: "Your support ticket has been resolved.",
      closed: "Your support ticket has been closed.",
    };

    await sendNotification(userId, {
      type: "general",
      title: `Support ticket updated: ${subject}`,
      body: notificationMap[status],
      link: `/support/${ticketId}`,
    });
  }

  private normalizeTicket(id: string, ticket: SupportTicket): SupportTicket {
    return {
      ...ticket,
      id,
      lastMessageAt: ticket.lastMessageAt
        ? ticket.lastMessageAt.toDate?.()?.toISOString?.() ?? ticket.lastMessageAt
        : new Date().toISOString(),
      createdAt: ticket.createdAt
        ? ticket.createdAt.toDate?.()?.toISOString?.() ?? ticket.createdAt
        : new Date().toISOString(),
      updatedAt: ticket.updatedAt
        ? ticket.updatedAt.toDate?.()?.toISOString?.() ?? ticket.updatedAt
        : new Date().toISOString(),
    };
  }
}
