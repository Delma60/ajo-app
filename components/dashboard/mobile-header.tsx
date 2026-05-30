"use client";

import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/stores/auth-store";

interface MobileHeaderProps {
  unreadCount?: number;
  onMenuOpen?: () => void;
}

export function MobileHeader({ unreadCount = 0, onMenuOpen }: MobileHeaderProps) {
  const { appUser } = useAuthStore();

  const initials = appUser?.name
    ? appUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const firstName = appUser?.name?.split(" ")[0] ?? "there";

  return (
    <header className="sticky top-0 z-30 md:hidden flex items-center justify-between h-14 px-4 bg-background/95 backdrop-blur-sm border-b border-border">
      {/* Logo / greeting */}
      <div className="flex items-center gap-2.5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm select-none">
            A
          </span>
        </Link>
        <div>
          <p className="text-xs text-muted-foreground leading-none">
            Hello, {firstName} 👋
          </p>
          <p className="text-sm font-semibold text-foreground leading-tight">
            AjoSave
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" asChild className="relative">
          <Link href="/notifications">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />
            )}
            <span className="sr-only">Notifications</span>
          </Link>
        </Button>
        <Link href="/settings">
          <Avatar size="sm" className="cursor-pointer">
            <AvatarImage src={appUser?.avatarUrl} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}