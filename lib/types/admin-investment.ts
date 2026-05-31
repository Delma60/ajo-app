// ─── Admin Investment view type ───────────────────────────────────────────────

export interface AdminInvestment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  packageId: string;
  packageName: string;
  packageCategory: "treasury-bills" | "money-market" | "fixed-deposit" | "mutual-fund";
  principalKobo: number;
  annualYieldPercent: number;
  durationDays: number;
  expectedReturnKobo: number;
  interestKobo: number;
  status: "active" | "matured" | "withdrawn" | "cancelled";
  riskLevel: "low" | "medium" | "high";
  startDate: string | null;
  maturityDate: string | null;
  withdrawnAt: string | null;
  cancelledAt: string | null;
  transactionId: string;
  createdAt: string | null;
  updatedAt: string | null;
  // Derived
  progressPercent: number;
  daysRemaining: number;
  accruedValueKobo: number;
  isMatured: boolean;
}

export interface AdminInvestmentStats {
  totalActiveKobo: number;
  totalExpectedReturnKobo: number;
  totalWithdrawnKobo: number;
  activeCount: number;
  maturedCount: number;
  withdrawnCount: number;
  cancelledCount: number;
  platformFeesKobo: number;
}

// ─── Status metadata ──────────────────────────────────────────────────────────

export const STATUS_META: Record<
  AdminInvestment["status"],
  { label: string; cls: string; dotCls: string }
> = {
  active: {
    label: "Active",
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dotCls: "bg-blue-500",
  },
  matured: {
    label: "Matured",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    dotCls: "bg-emerald-500",
  },
  withdrawn: {
    label: "Withdrawn",
    cls: "bg-muted text-muted-foreground",
    dotCls: "bg-muted-foreground",
  },
  cancelled: {
    label: "Cancelled",
    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dotCls: "bg-red-500",
  },
};

// ─── Risk metadata ────────────────────────────────────────────────────────────

export const RISK_META: Record<
  AdminInvestment["riskLevel"],
  { label: string; cls: string }
> = {
  low: {
    label: "Low Risk",
    cls: "text-emerald-600 dark:text-emerald-400",
  },
  medium: {
    label: "Medium Risk",
    cls: "text-amber-600 dark:text-amber-400",
  },
  high: {
    label: "High Risk",
    cls: "text-red-600 dark:text-red-400",
  },
};

// ─── Category metadata ────────────────────────────────────────────────────────

export const CATEGORY_META: Record<
  AdminInvestment["packageCategory"],
  { label: string; icon: string }
> = {
  "treasury-bills": { label: "Treasury Bills", icon: "🏛️" },
  "money-market": { label: "Money Market", icon: "💹" },
  "fixed-deposit": { label: "Fixed Deposit", icon: "🔒" },
  "mutual-fund": { label: "Mutual Fund", icon: "📈" },
};