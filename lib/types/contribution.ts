import type { Timestamp } from "firebase/firestore";

export interface Contribution {
  id: string;
  circleId: string;
  userId: string;
  cycle: number;
  amount: number; // kobo
  // Status state machine: pending → paid | late; late → paid | missed
  status: "pending" | "paid" | "late" | "missed";
  dueDate: Timestamp;
  paidAt?: Timestamp;
  transactionId?: string;
  penaltyAmount?: number; // kobo
  penaltyPaid?: boolean;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}