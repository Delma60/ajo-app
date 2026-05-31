"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  CircleDollarSign,
  ArrowLeftRight,
  Gavel,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Bell,
  TrendingUp,
  Activity,
  Menu,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { signOut } from "@/lib/firebase/auth";
import { useAuthStore } from "@/lib/stores/auth-store";

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/admin/dashboard",
      },
      {
        icon: Activity,
        label: "Analytics",
        href: "/admin/analytics",
        badge: "Soon",
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        icon: Users,
        label: "Users",
        href: "/admin/users",
      },
      {
        icon: CircleDollarSign,
        label: "Circles",
        href: "/admin/circles",
      },
      {
        icon: ArrowLeftRight,
        label: "Transactions",
        href: "/admin/transactions",
      },
      {
        icon: TrendingUp,
        label: "Investments",
        href: "/admin/investments",
        badge: "Soon",
      },
    ],
  },
  {
    label: "Support",
    items: [
      {
        icon: Gavel,
        label: "Disputes",
        href: "/admin/disputes",
      },
      {
        icon: Bell,
        label: "Notifications",
        href: "/admin/notifications",
        badge: "Soon",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        icon: Settings,
        label: "Settings",
        href: "/admin/settings",
        badge: "Soon",
      },
    ],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavLink({
  item,
  collapsed,
  onClick,
}: {
  item: NavItem;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const isSoon = item.badge === "Soon";

  const inner = (
    <Link
      href={isSoon ? "#" : item.href}
      onClick={isSoon ? (e) => e.preventDefault() : onClick}
      aria-disabled={isSoon}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        collapsed ? "justify-center px-2" : "",
        isActive
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
          : isSoon
            ? "cursor-not-allowed text-muted-foreground/50"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-emerald-600 dark:bg-emerald-400" />
      )}

      <item.icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          isActive
            ? "text-emerald-600 dark:text-emerald-400"
            : isSoon
              ? "text-muted-foreground/40"
              : "text-muted-foreground group-hover:text-foreground",
        )}
      />

      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <Badge
              variant="secondary"
              className={cn(
                "ml-auto h-4 px-1.5 text-[10px] font-medium",
                isActive
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {item.badge}
            </Badge>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {item.label}
          {item.badge && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {item.badge}
            </Badge>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return inner;
}

function SidebarContent({
  collapsed,
  onNavClick,
}: {
  collapsed: boolean;
  onNavClick?: () => void;
}) {
  const router = useRouter();
  const { appUser } = useAuthStore();
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
    : "A";

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border/60",
          collapsed ? "justify-center px-3" : "gap-2.5 px-4",
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
          <Shield className="size-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-none text-foreground">
              Admin Panel
            </p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              AjoSave
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              {collapsed && (
                <div className="mb-1.5 flex justify-center">
                  <div className="h-px w-4 bg-border" />
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    collapsed={collapsed}
                    onClick={onNavClick}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Back to app */}
      <div className="px-2 py-2">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/dashboard"
                className="flex items-center justify-center rounded-lg px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Back to App</TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            Back to app
          </Link>
        )}
      </div>

      <Separator className="opacity-60" />

      {/* User footer */}
      <div className="shrink-0 p-2">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex w-full items-center justify-center rounded-lg p-2 transition-colors hover:bg-muted">
                <Avatar size="sm">
                  <AvatarImage src={appUser?.avatarUrl} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[10px] font-semibold dark:bg-emerald-950 dark:text-emerald-400">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {appUser?.name ?? "Admin"}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="group flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted">
            <Avatar size="sm">
              <AvatarImage src={appUser?.avatarUrl} />
              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-[10px] font-semibold dark:bg-emerald-950 dark:text-emerald-400">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold text-foreground leading-none">
                {appUser?.name ?? "Admin"}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground leading-none">
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
                  className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mobile Sheet ─────────────────────────────────────────────────────────────

function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-64 p-0 bg-background"
        showCloseButton
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Admin Navigation</SheetTitle>
        </SheetHeader>
        <SidebarContent
          collapsed={false}
          onNavClick={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

// ─── Mobile Header ────────────────────────────────────────────────────────────

export function AdminMobileHeader({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur-sm md:hidden">
      <Button variant="ghost" size="icon-sm" onClick={onMenuOpen}>
        <Menu className="size-4" />
        <span className="sr-only">Open menu</span>
      </Button>
      <div className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-emerald-700 text-white">
          <Shield className="size-3.5" />
        </div>
        <span className="text-sm font-semibold">Admin Panel</span>
      </div>
    </header>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function AdminSidebar({
  mobileOpen,
  setMobileOpen,
}: {
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen sticky top-0 shrink-0 border-r border-border/60 bg-background transition-[width] duration-200 ease-in-out",
          collapsed ? "w-14" : "w-56",
        )}
      >
        <SidebarContent collapsed={collapsed} />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "absolute -right-3 top-[3.5rem] flex size-6 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted z-10",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="size-3 text-muted-foreground" />
          ) : (
            <ChevronLeft className="size-3 text-muted-foreground" />
          )}
        </button>
      </aside>

      {/* Mobile sheet */}
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />
    </>
  );
}

// Export mobile header trigger hook
export function useAdminMobileMenu() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
