"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthStore } from "@/lib/stores/auth-store";
import { signOut } from "@/lib/firebase/auth";
import { useNativeBridge } from "@/hooks/use-native-bridge";
import { toast } from "sonner";
import { LogoutConfirmationDialog } from "@/components/shared/logout-confirmation-dialog";

interface MobileHeaderProps {
  unreadCount?: number;
}

export function MobileHeader({ unreadCount = 0 }: MobileHeaderProps) {
  const { appUser } = useAuthStore();
  const router = useRouter();
  const { haptic } = useNativeBridge();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const initials = appUser?.name
    ? appUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const firstName = appUser?.name?.split(" ")[0] ?? "there";

  async function handleSignOut() {
    setIsLoggingOut(true);
    try {
      await signOut();
      router.push("/login");
    } catch {
      toast.error("Failed to sign out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  function handleMenuOpen(open: boolean) {
    setMenuOpen(open);
    if (open) {
      haptic("selection");
    }
  }

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

        <Popover open={menuOpen} onOpenChange={handleMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="rounded-full border border-border bg-background p-0.5 shadow-sm transition hover:bg-muted"
              aria-label="Open account menu"
            >
              <Avatar size="sm" className="cursor-pointer">
                <AvatarImage src={appUser?.avatarUrl} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-52">
            <div className="space-y-2">
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground hover:bg-muted"
                onClick={() => haptic("light")}
              >
                <User className="size-4 text-foreground/80" />
                <span>Profile</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setLogoutDialogOpen(true);
                  haptic("warning");
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                <span>Sign out</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <LogoutConfirmationDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={handleSignOut}
        isLoading={isLoggingOut}
      />
    </header>
  );
}