import type { Timestamp } from "firebase/firestore";

export interface Notification {
  id: string;
  userId: string;
  type:
    | "contribution_due"
    | "payout_received"
    | "member_joined"
    | "circle_invite"
    | "penalty_applied"
    | "kyc_approved"
    | "dispute_raised"
    | "general";
  title: string;
  body: string;
  read: boolean;
  link?: string;
  createdAt: Timestamp;
}