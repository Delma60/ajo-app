import { Timestamp } from "firebase-admin/firestore";

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "waiting_on_user"
  | "resolved"
  | "closed";

export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";

export type SupportTicketCategory =
  | "account_access"
  | "payment_failure"
  | "wallet_issue"
  | "circle_problem"
  | "feature_request"
  | "general_inquiry";

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assignedTo?: string;
  screenshotUrl?: string;
  lastMessageAt: Date;
  createdAt: Date | Timestamp;
  updatedAt: Date;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: "user" | "agent";
  text: string;
  createdAt: string;
  isInternal: boolean;
  attachmentUrl?: string;
}

export const SUPPORT_CATEGORIES: Record<SupportTicketCategory, string> = {
  account_access: "Account access",
  payment_failure: "Payment failure",
  wallet_issue: "Wallet issue",
  circle_problem: "Circle problem",
  feature_request: "Feature request",
  general_inquiry: "General inquiry",
};

export const SUPPORT_PRIORITIES: Record<SupportTicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_user: "Waiting on user",
  resolved: "Resolved",
  closed: "Closed",
};
