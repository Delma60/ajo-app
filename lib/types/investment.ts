import type { Timestamp } from "firebase/firestore";

// ─── Market Packages ──────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high";
export type InvestmentDuration = 30 | 60 | 90 | 180 | 365;
export type InvestmentStatus =
  | "active"
  | "matured"
  | "withdrawn"
  | "cancelled";

export interface InvestmentPackage {
  id: string;
  name: string;
  description: string;
  annualYieldPercent: number; // e.g. 14 = 14% p.a.
  durationDays: InvestmentDuration;
  minAmountKobo: number;
  maxAmountKobo: number;
  riskLevel: RiskLevel;
  category: "treasury-bills" | "money-market" | "fixed-deposit" | "mutual-fund";
  isActive: boolean;
  badgeLabel?: string; // e.g. "Popular", "High Yield"
  features: string[];
}

// ─── User Investment (position) ───────────────────────────────────────────────

export interface Investment {
  id: string;
  userId: string;
  packageId: string;
  packageName: string;
  packageCategory: InvestmentPackage["category"];
  principalKobo: number;
  annualYieldPercent: number;
  durationDays: number;
  expectedReturnKobo: number; // principal + interest
  interestKobo: number;
  status: InvestmentStatus;
  startDate: Timestamp;
  maturityDate: Timestamp;
  withdrawnAt?: Timestamp;
  cancelledAt?: Timestamp;
  transactionId: string;
  riskLevel: RiskLevel;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Derived / computed ───────────────────────────────────────────────────────

export interface InvestmentWithProgress extends Investment {
  /** 0–100, how far through the lock period */
  progressPercent: number;
  /** Days remaining until maturity */
  daysRemaining: number;
  /** Current accrued value in kobo (linear interpolation) */
  accruedValueKobo: number;
  /** Whether the investment has passed its maturity date */
  isMatured: boolean;
}

// ─── Portfolio summary ────────────────────────────────────────────────────────

export interface InvestmentPortfolioSummary {
  totalInvestedKobo: number;
  totalExpectedReturnKobo: number;
  totalInterestEarnedKobo: number; // from matured/withdrawn
  totalAccruedKobo: number; // from active positions
  activeCount: number;
  maturedCount: number;
  withdrawnCount: number;
  averageYieldPercent: number;
}

// ─── Static package catalog (used client-side, no Firestore needed) ───────────

export const INVESTMENT_PACKAGES: InvestmentPackage[] = [
  {
    id: "pkg-tbills-30",
    name: "Treasury Bills",
    description:
      "Government-backed short-term securities. Virtually zero default risk with guaranteed returns.",
    annualYieldPercent: 18.5,
    durationDays: 30,
    minAmountKobo: 500_000, // ₦5,000
    maxAmountKobo: 100_000_000, // ₦1,000,000
    riskLevel: "low",
    category: "treasury-bills",
    isActive: true,
    badgeLabel: "Safest",
    features: [
      "Government-guaranteed",
      "30-day lock period",
      "Auto-rollover option",
      "No hidden fees",
    ],
  },
  {
    id: "pkg-mmarket-90",
    name: "Money Market Fund",
    description:
      "Diversified pool of short-term instruments. Ideal balance between liquidity and returns.",
    annualYieldPercent: 22.0,
    durationDays: 90,
    minAmountKobo: 1_000_000, // ₦10,000
    maxAmountKobo: 500_000_000, // ₦5,000,000
    riskLevel: "low",
    category: "money-market",
    isActive: true,
    badgeLabel: "Popular",
    features: [
      "Diversified portfolio",
      "90-day lock period",
      "Daily accrual",
      "SEC-regulated",
    ],
  },
  {
    id: "pkg-fixed-180",
    name: "Fixed Deposit",
    description:
      "Lock your funds for 6 months and earn premium rates above standard savings.",
    annualYieldPercent: 26.5,
    durationDays: 180,
    minAmountKobo: 5_000_000, // ₦50,000
    maxAmountKobo: 1_000_000_000, // ₦10,000,000
    riskLevel: "medium",
    category: "fixed-deposit",
    isActive: true,
    badgeLabel: "High Yield",
    features: [
      "Fixed 26.5% p.a.",
      "6-month term",
      "NDIC insured",
      "Priority customer support",
    ],
  },
  {
    id: "pkg-mutual-365",
    name: "Mutual Fund",
    description:
      "Professionally managed equity and bond portfolio for maximum long-term growth.",
    annualYieldPercent: 31.0,
    durationDays: 365,
    minAmountKobo: 10_000_000, // ₦100,000
    maxAmountKobo: 5_000_000_000, // ₦50,000,000
    riskLevel: "high",
    category: "mutual-fund",
    isActive: true,
    badgeLabel: "Max Growth",
    features: [
      "Equity + bonds mix",
      "12-month horizon",
      "Expert fund managers",
      "Quarterly statements",
    ],
  },
];

// ─── Label maps ───────────────────────────────────────────────────────────────

export const RISK_META: Record<
  RiskLevel,
  { label: string; badgeCls: string; dotCls: string }
> = {
  low: {
    label: "Low Risk",
    badgeCls:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    dotCls: "bg-emerald-500",
  },
  medium: {
    label: "Medium Risk",
    badgeCls:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    dotCls: "bg-amber-400",
  },
  high: {
    label: "High Risk",
    badgeCls:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dotCls: "bg-red-500",
  },
};

export const CATEGORY_META: Record<
  InvestmentPackage["category"],
  { label: string; icon: string }
> = {
  "treasury-bills": { label: "Treasury Bills", icon: "🏛️" },
  "money-market": { label: "Money Market", icon: "💹" },
  "fixed-deposit": { label: "Fixed Deposit", icon: "🔒" },
  "mutual-fund": { label: "Mutual Fund", icon: "📈" },
};

export const STATUS_META: Record<
  InvestmentStatus,
  { label: string; badgeCls: string }
> = {
  active: {
    label: "Active",
    badgeCls:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  matured: {
    label: "Matured",
    badgeCls:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  withdrawn: {
    label: "Withdrawn",
    badgeCls: "bg-muted text-muted-foreground",
  },
  cancelled: {
    label: "Cancelled",
    badgeCls:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};