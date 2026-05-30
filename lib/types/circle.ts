import type { Timestamp } from "firebase/firestore";

export interface Circle {
  id: string;
  name: string;
  description: string;
  adminId: string;
  memberIds: string[];
  maxMembers: number;
  contribution: number; // kobo
  frequency: "daily" | "weekly" | "bi-weekly" | "monthly";
  payoutOrder: "rotational" | "random" | "bidding";
  status: "active" | "paused" | "completed" | "cancelled";
  isPrivate: boolean;
  currentCycle: number;
  totalCycles: number;
  nextDueDate: Timestamp;
  nextPayoutDate: Timestamp;
  currentRecipientId: string;
  trustScore: number;
  trustScoreBreakdown: {
    onTimePayments: number;
    latePayments: number;
    missedPayments: number;
    lastUpdated: Timestamp;
  };
  saved: number; // kobo — total saved so far
  creationFee: number; // kobo
  tags: string[];
  pendingRequestIds: string[];
  inviteCode: string;
  activeBidId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Derived field — always compute at read time, never store
export type CircleWithGoal = Circle & { goal: number };

export const FREQ_LABELS: Record<Circle["frequency"], string> = {
  daily: "Daily",
  weekly: "Weekly",
  "bi-weekly": "Bi-weekly",
  monthly: "Monthly",
};

export const PAYOUT_LABELS: Record<Circle["payoutOrder"], string> = {
  rotational: "Rotational",
  random: "Random draw",
  bidding: "Bidding",
};

export const STATUS_META: Record<
  Circle["status"],
  { label: string; badgeCls: string }
> = {
  active: {
    label: "Active",
    badgeCls:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  paused: {
    label: "Paused",
    badgeCls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  completed: {
    label: "Completed",
    badgeCls: "bg-muted text-muted-foreground",
  },
  cancelled: {
    label: "Cancelled",
    badgeCls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};