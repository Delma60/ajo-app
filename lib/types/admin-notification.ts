// ─── Admin Notification view type ────────────────────────────────────────────

export interface AdminNotification {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  type:
    | "contribution_due"
    | "payout_received"
    | "member_joined"
    | "circle_invite"
    | "penalty_applied"
    | "dispute_raised"
    | "general";
  title: string;
  body: string;
  read: boolean;
  link: string | null;
  createdAt: string | null;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface AdminNotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Partial<Record<AdminNotification["type"], number>>;
}

// ─── Type metadata ────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPE_META: Record<
  AdminNotification["type"],
  { label: string; icon: string; cls: string; badgeCls: string; dotCls: string }
> = {
  contribution_due: {
    label: "Contribution Due",
    icon: "⏰",
    cls: "text-amber-700 dark:text-amber-400",
    badgeCls:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/30",
    dotCls: "bg-amber-500",
  },
  payout_received: {
    label: "Payout Received",
    icon: "🎉",
    cls: "text-emerald-700 dark:text-emerald-400",
    badgeCls:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/30",
    dotCls: "bg-emerald-500",
  },
  member_joined: {
    label: "Member Joined",
    icon: "👥",
    cls: "text-blue-700 dark:text-blue-400",
    badgeCls:
      "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/30",
    dotCls: "bg-blue-500",
  },
  circle_invite: {
    label: "Circle Invite",
    icon: "✉️",
    cls: "text-purple-700 dark:text-purple-400",
    badgeCls:
      "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/30",
    dotCls: "bg-purple-500",
  },
  penalty_applied: {
    label: "Penalty Applied",
    icon: "⚠️",
    cls: "text-red-700 dark:text-red-400",
    badgeCls:
      "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/30",
    dotCls: "bg-red-500",
  },
  dispute_raised: {
    label: "Dispute Raised",
    icon: "⚖️",
    cls: "text-orange-700 dark:text-orange-400",
    badgeCls:
      "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/30",
    dotCls: "bg-orange-500",
  },
  general: {
    label: "General",
    icon: "🔔",
    cls: "text-muted-foreground",
    badgeCls: "bg-muted text-muted-foreground border-border",
    dotCls: "bg-muted-foreground",
  },
};