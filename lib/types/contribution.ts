

export interface Contribution {
  id: string;
  circleId: string;
  userId: string;
  cycle: number;
  amount: number; // kobo
  // Status state machine: pending → paid | late; late → paid | missed
  status: "pending" | "paid" | "late" | "missed";
  dueDate: any;
  paidAt?: any;
  transactionId?: string;
  penaltyAmount?: number; // kobo
  penaltyPaid?: boolean;
  createdAt: any;
  updatedAt?: any;
}