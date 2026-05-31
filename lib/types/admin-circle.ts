// ─── Admin Circle type ────────────────────────────────────────────────────────

export interface AdminCircle {
  id: string;
  name: string;
  description: string;
  adminId: string;
  memberIds: string[];
  memberCount: number;
  maxMembers: number;
  fillPercent: number;
  contribution: number; // kobo
  goal: number; // kobo (derived)
  frequency: "daily" | "weekly" | "bi-weekly" | "monthly";
  payoutOrder: "rotational" | "random" | "bidding";
  status: "active" | "paused" | "completed" | "cancelled";
  isPrivate: boolean;
  currentCycle: number;
  totalCycles: number;
  trustScore: number;
  trustScoreBreakdown: {
    onTimePayments: number;
    latePayments: number;
    missedPayments: number;
    lastUpdated: string | null;
  } | null;
  saved: number; // kobo
  tags: string[];
  pendingRequestIds: string[];
  inviteCode: string;
  nextDueDate: string | null;
  nextPayoutDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ─── Status metadata ──────────────────────────────────────────────────────────

export const STATUS_META: Record<
  AdminCircle["status"],
  { label: string; cls: string; dotCls: string }
> = {
  active: {
    label: "Active",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    dotCls: "bg-emerald-500",
  },
  paused: {
    label: "Paused",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    dotCls: "bg-amber-400",
  },
  completed: {
    label: "Completed",
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dotCls: "bg-blue-500",
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dotCls: "bg-red-500",
  },
};

// ─── Frequency labels ─────────────────────────────────────────────────────────

export const FREQ_LABELS: Record<AdminCircle["frequency"], string> = {
  daily: "Daily",
  weekly: "Weekly",
  "bi-weekly": "Bi-weekly",
  monthly: "Monthly",
};

// ─── Payout order labels ──────────────────────────────────────────────────────

export const PAYOUT_LABELS: Record<AdminCircle["payoutOrder"], string> = {
  rotational: "Rotational",
  random: "Random draw",
  bidding: "Bidding",
};

// ─── Trust tier helper ────────────────────────────────────────────────────────

export function TRUST_TIER(score: number): {
  label: string;
  cls: string;
  barCls: string;
} {
  if (score >= 90)
    return {
      label: "Excellent",
      cls: "text-emerald-600 dark:text-emerald-400",
      barCls: "[&>[data-slot=progress-indicator]]:bg-emerald-500",
    };
  if (score >= 70)
    return {
      label: "Good",
      cls: "text-blue-600 dark:text-blue-400",
      barCls: "[&>[data-slot=progress-indicator]]:bg-blue-500",
    };
  if (score >= 50)
    return {
      label: "Fair",
      cls: "text-amber-600 dark:text-amber-400",
      barCls: "[&>[data-slot=progress-indicator]]:bg-amber-400",
    };
  if (score >= 25)
    return {
      label: "Low",
      cls: "text-orange-600 dark:text-orange-400",
      barCls: "[&>[data-slot=progress-indicator]]:bg-orange-500",
    };
  return {
    label: "At Risk",
    cls: "text-red-600 dark:text-red-400",
    barCls: "[&>[data-slot=progress-indicator]]:bg-red-500",
  };
}