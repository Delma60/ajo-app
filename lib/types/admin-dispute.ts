// ─── Admin Dispute view type ──────────────────────────────────────────────────

export interface AdminDispute {
  id: string;
  circleId: string;
  circleName: string;
  raisedBy: string;
  reporterName: string;
  reporterEmail: string;
  reporterAvatarUrl: string | null;
  againstUserId: string | null;
  againstUserName: string | null;
  againstUserEmail: string | null;
  type: "missed_payout" | "admin_abuse" | "fraudulent_member" | "other";
  description: string;
  status: "open" | "under_review" | "resolved" | "dismissed";
  resolution: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// ─── Status metadata ──────────────────────────────────────────────────────────

export const DISPUTE_STATUS_META: Record<
  AdminDispute["status"],
  { label: string; cls: string; dotCls: string; badgeCls: string }
> = {
  open: {
    label: "Open",
    cls: "text-red-700 dark:text-red-400",
    dotCls: "bg-red-500",
    badgeCls:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/30",
  },
  under_review: {
    label: "Under Review",
    cls: "text-amber-700 dark:text-amber-400",
    dotCls: "bg-amber-500",
    badgeCls:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/30",
  },
  resolved: {
    label: "Resolved",
    cls: "text-emerald-700 dark:text-emerald-400",
    dotCls: "bg-emerald-500",
    badgeCls:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/30",
  },
  dismissed: {
    label: "Dismissed",
    cls: "text-muted-foreground",
    dotCls: "bg-muted-foreground",
    badgeCls: "bg-muted text-muted-foreground border-border",
  },
};

// ─── Type metadata ────────────────────────────────────────────────────────────

export const DISPUTE_TYPE_META: Record<
  AdminDispute["type"],
  { label: string; icon: string; cls: string }
> = {
  missed_payout: {
    label: "Missed Payout",
    icon: "💸",
    cls: "text-orange-600 dark:text-orange-400",
  },
  admin_abuse: {
    label: "Admin Abuse",
    icon: "⚠️",
    cls: "text-red-600 dark:text-red-400",
  },
  fraudulent_member: {
    label: "Fraudulent Member",
    icon: "🚫",
    cls: "text-red-600 dark:text-red-400",
  },
  other: {
    label: "Other",
    icon: "📋",
    cls: "text-muted-foreground",
  },
};

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface AdminDisputeStats {
  total: number;
  open: number;
  under_review: number;
  resolved: number;
  dismissed: number;
}