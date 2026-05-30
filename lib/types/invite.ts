import type { Timestamp } from "firebase/firestore";

export interface Invite {
  id: string;
  circleId: string;
  senderId: string;
  recipientId?: string;
  recipientEmail?: string;
  type: "invite" | "request";
  status: "pending" | "accepted" | "rejected" | "cancelled";
  token: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}