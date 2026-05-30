"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  Users2Icon,
  WalletIcon,
  BellIcon,
  UserIcon,
} from "lucide-react";
import { useUnreadNotificationCount } from "@/lib/hooks/use-notifications";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboardIcon },
  { href: "/circles", label: "Circles", icon: Users2Icon },
  { href: "/wallet", label: "Wallet", icon: WalletIcon },
  { href: "/notifications", label: "Alerts", icon: BellIcon, isNotifications: true },
  { href: "/settings", label: "Profile", icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  const unreadCount = useUnreadNotificationCount();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon, isNotifications }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full py-2",
                "text-[10px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={label}
            >
              <div className="relative">
                <Icon className="size-5 shrink-0" />

                {/* Live badge */}
                {isNotifications && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-bold text-primary-foreground leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}