"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Wallet,
  Bell,
  User,
  Settings,
  TrendingUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { signOut } from "@/lib/firebase/auth";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const NAV_ITEMS = [
  { icon: Home, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Circles", href: "/circles" },
  { icon: Wallet, label: "Wallet", href: "/wallet" },
  { icon: TrendingUp, label: "Investments", href: "/investments" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

interface SidebarProps {
  unreadCount?: number;
}

export function DashboardSidebar({ unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { appUser } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleSignOut() {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push("/login");
    } catch {
      toast.error("Failed to sign out.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  const initials = appUser?.name
    ? appUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 bg-sidebar border-r border-sidebar-border transition-[width] duration-200 ease-in-out shrink-0",
        collapsed ? "w-[3.5rem]" : "w-[15rem]"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-14 px-3 border-b border-sidebar-border shrink-0",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-base select-none">
              A
            </span>
            <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
              AjoSave
            </span>
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-base select-none">
              A
            </span>
          </Link>
        )}
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed(true)}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="flex justify-center pt-2 px-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed(false)}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground w-full"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const isNotifications = item.href === "/notifications";
          const showBadge = isNotifications && unreadCount > 0;

          const navItem = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors relative",
                collapsed ? "justify-center px-2" : "",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {showBadge && !collapsed && (
                <Badge
                  variant="default"
                  className="ml-auto h-4 min-w-4 px-1 text-[10px] bg-primary"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
              {showBadge && collapsed && (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return navItem;
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User footer */}
      <div className={cn("p-2 shrink-0", collapsed ? "" : "")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex w-full items-center justify-center p-2 rounded-md hover:bg-sidebar-accent/60 transition-colors">
                <Avatar size="sm">
                  <AvatarImage src={appUser?.avatarUrl} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {appUser?.name ?? "Profile"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2 rounded-md p-2 hover:bg-sidebar-accent/60 transition-colors group">
            <Avatar size="sm">
              <AvatarImage src={appUser?.avatarUrl} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {appUser?.name ?? "Loading…"}
              </p>
              <p className="text-[11px] text-sidebar-foreground/50 truncate">
                {appUser?.email ?? ""}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleSignOut}
                  disabled={isLoggingOut}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-sidebar-foreground/60 hover:text-destructive"
                >
                  <LogOut className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  );
}