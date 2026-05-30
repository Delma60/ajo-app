"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BellIcon,
  CheckCheckIcon,
  Users2Icon,
  WalletIcon,
  CircleDollarSign,
  AlertTriangleIcon,
  ShieldCheckIcon,
  InfoIcon,
  GavelIcon,
  ChevronRightIcon,
  Loader2,
} from "lucide-react";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types/notification";

// ─── Notification type metadata ───────────────────────────────────────────────

const TYPE_META: Record<
  Notification["type"],
  {
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    label: string;
  }
> = {
  contribution_due: {
    icon: WalletIcon,
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    iconColor: "text-amber-600 dark:text-amber-400",
    label: "Contribution Due",
  },
  payout_received: {
    icon: CircleDollarSign,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    label: "Payout",
  },
  member_joined: {
    icon: Users2Icon,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    label: "Member",
  },
  circle_invite: {
    icon: GavelIcon,
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    iconColor: "text-purple-600 dark:text-purple-400",
    label: "Invite",
  },
  penalty_applied: {
    icon: AlertTriangleIcon,
    iconBg: "bg-red-100 dark:bg-red-900/30",
    iconColor: "text-red-600 dark:text-red-400",
    label: "Penalty",
  },
  kyc_approved: {
    icon: ShieldCheckIcon,
    iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    label: "KYC",
  },
  dispute_raised: {
    icon: AlertTriangleIcon,
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
    label: "Dispute",
  },
  general: {
    icon: InfoIcon,
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    label: "Info",
  },
};

// ─── Relative time formatter ──────────────────────────────────────────────────

function relativeTime(timestamp: any): string {
  const date: Date =
    timestamp?.toDate?.() instanceof Date
      ? timestamp.toDate()
      : timestamp instanceof Date
      ? timestamp
      : new Date();

  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
  }).format(date);
}

// ─── Single notification row ──────────────────────────────────────────────────

interface NotificationRowProps {
  notification: Notification;
  onRead: (id: string) => void;
}

function NotificationRow({ notification, onRead }: NotificationRowProps) {
  const meta = TYPE_META[notification.type] ?? TYPE_META.general;
  const Icon = meta.icon;

  function handleClick() {
    if (!notification.read) {
      onRead(notification.id);
    }
  }

  const inner = (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3.5 transition-colors cursor-pointer",
        "border-b border-border last:border-0",
        !notification.read
          ? "bg-primary/[0.03] hover:bg-primary/[0.06] dark:bg-primary/5 dark:hover:bg-primary/10"
          : "hover:bg-muted/40"
      )}
      onClick={handleClick}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          meta.iconBg
        )}
      >
        <Icon className={cn("size-3.5", meta.iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm leading-snug",
              !notification.read ? "font-semibold text-foreground" : "font-medium text-foreground/80"
            )}
          >
            {notification.title}
          </p>
          {notification.link && (
            <ChevronRightIcon className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {notification.body}
        </p>

        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {relativeTime(notification.createdAt)}
          </span>
          <Badge
            variant="outline"
            className="text-[9px] h-3.5 px-1 border-border/60 text-muted-foreground"
          >
            {meta.label}
          </Badge>
        </div>
      </div>

      {/* Unread dot */}
      <div className="shrink-0 mt-1.5 size-2">
        {!notification.read && (
          <span className="block size-2 rounded-full bg-primary" />
        )}
      </div>
    </div>
  );

  if (notification.link) {
    return (
      <Link href={notification.link} className="block">
        {inner}
      </Link>
    );
  }

  return inner;
}

// ─── Row skeleton ─────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0">
      <Skeleton className="size-9 rounded-xl shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="size-2 rounded-full shrink-0 mt-1.5" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted mb-4">
        <BellIcon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">
        {filtered ? "No notifications here" : "You're all caught up"}
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        {filtered
          ? "Switch to 'All' to see your full history."
          : "No new notifications. We'll let you know when something needs your attention."}
      </p>
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

export function NotificationsContent() {
  const {
    notifications,
    isLoading,
    isLoadingMore,
    hasMore,
    unreadCount,
    loadMore,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const [tab, setTab] = useState<"all" | "unread" | "contributions" | "payouts">("all");

  function filterNotifications(list: Notification[]) {
    switch (tab) {
      case "unread":
        return list.filter((n) => !n.read);
      case "contributions":
        return list.filter(
          (n) => n.type === "contribution_due" || n.type === "penalty_applied"
        );
      case "payouts":
        return list.filter((n) => n.type === "payout_received");
      default:
        return list;
    }
  }

  const filtered = filterNotifications(notifications);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-5 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "Stay up to date with your activity."}
            </p>
          </div>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={markAllAsRead}
            >
              <CheckCheckIcon className="size-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Filter tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="h-auto p-1 gap-1 flex-wrap">
            <TabsTrigger value="all" className="text-xs h-7 px-3">
              All
              {notifications.length > 0 && (
                <span className="ml-1.5 text-muted-foreground">
                  {notifications.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs h-7 px-3">
              Unread
              {unreadCount > 0 && (
                <span className="ml-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="contributions" className="text-xs h-7 px-3">
              Contributions
            </TabsTrigger>
            <TabsTrigger value="payouts" className="text-xs h-7 px-3">
              Payouts
            </TabsTrigger>
          </TabsList>

          {/* All tabs share one panel since we filter above */}
          {(["all", "unread", "contributions", "payouts"] as const).map(
            (t) => (
              <TabsContent key={t} value={t} className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    {isLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <RowSkeleton key={i} />
                      ))
                    ) : filtered.length === 0 ? (
                      <EmptyState filtered={t !== "all"} />
                    ) : (
                      <>
                        {filtered.map((n) => (
                          <NotificationRow
                            key={n.id}
                            notification={n}
                            onRead={markAsRead}
                          />
                        ))}

                        {/* Load more */}
                        {hasMore && t === "all" && (
                          <div className="px-4 py-3 border-t border-border">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              disabled={isLoadingMore}
                              onClick={loadMore}
                            >
                              {isLoadingMore ? (
                                <>
                                  <Loader2 className="size-3.5 animate-spin" />
                                  Loading…
                                </>
                              ) : (
                                "Load older notifications"
                              )}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )
          )}
        </Tabs>
      </div>
    </div>
  );
}