import type { Timestamp } from "firebase/firestore";

export interface Transaction {
  id: string;
  userId: string;
  circleId?: string;
  type:
    | "deposit"
    | "withdrawal"
    | "contribution"
    | "payout"
    | "penalty"
    | "referral_bonus"
    | "event_reward"
    | "creation_fee";
  direction: "credit" | "debit";
  amount: number; // kobo
  fee: number; // kobo
  netAmount: number; // kobo
  status: "pending" | "success" | "failed" | "cancelled";
  provider?: "flutterwave";
  providerReference?: string;
  reference: string;
  description: string;
  meta?: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}