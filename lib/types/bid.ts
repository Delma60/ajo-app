

export interface Bid {
  id: string;
  circleId: string;
  cycle: number;
  userId: string;
  amount: number; // bid premium in kobo
  status: "active" | "won" | "lost" | "cancelled";
  deadline: any;
  createdAt: any;
}