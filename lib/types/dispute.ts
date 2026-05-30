import type { Timestamp } from "firebase/firestore";

export interface Dispute {
  id: string;
  circleId: string;
  raisedBy: string;
  againstUserId?: string;
  type:
    | "missed_payout"
    | "admin_abuse"
    | "fraudulent_member"
    | "other";
  description: string;
  status: "open" | "under_review" | "resolved" | "dismissed";
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}