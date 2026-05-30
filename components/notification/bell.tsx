"use client";

import Link from "next/link";
import { BellIcon } from "lucide-react";
import { useUnreadNotificationCount } from "@/lib/hooks/use-notifications";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  /** If true renders a compact icon-only button suitable for the sidebar */
  compact?: boolean;
  className?: string;
}

export function NotificationBell({ compact = false, className }: NotificationBellProps) {
  const count = useUnreadNotificationCount();
  const capped = count > 99 ? "99+" : count;

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `${count} unread notifications` : "Notifications"}
      className={cn(
        "relative inline-flex items-center justify-center rounded-lg transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-muted",
        compact ? "size-8" : "h-8 gap-2 px-2.5 text-sm",
        className
      )}
    >
      <BellIcon className="size-4 shrink-0" />

      {!compact && <span className="hidden sm:block">Notifications</span>}

      {count > 0 && (
        <span
          aria-hidden
          className={cn(
            "absolute flex items-center justify-center rounded-full",
            "bg-primary text-primary-foreground font-bold leading-none",
            compact
              ? "top-0.5 right-0.5 size-4 text-[9px]"
              : "top-0.5 right-0.5 min-w-[16px] h-4 px-1 text-[9px]"
          )}
        >
          {capped}
        </span>
      )}
    </Link>
  );
}