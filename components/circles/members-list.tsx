"use client";

import { useState } from "react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  Crown,
  MoreHorizontalIcon,
  UserXIcon,
  AlertTriangleIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MemberData {
  uid: string;
  name: string;
  avatarUrl?: string;
  turnPosition: number; // 1-indexed
  paymentStatus: "up_to_date" | "late" | "missed";
  isCurrentRecipient: boolean;
  isPaused?: boolean;
}

interface MembersListProps {
  members: MemberData[];
  adminId: string;
  currentUserId: string;
  isAdmin: boolean;
  isShiftEnabled?: boolean;
  memberActionLoadingId?: string;
  onPause?: (uid: string) => void;
  onResume?: (uid: string) => void;
  onShift?: (uid: string) => void;
  onRemoveMember?: (uid: string) => void;
  isLoading?: boolean;
}

const STATUS_META = {
  up_to_date: {
    icon: CheckCircle2Icon,
    cls: "text-emerald-600",
    label: "Up to date",
  },
  late: {
    icon: ClockIcon,
    cls: "text-amber-500",
    label: "Late",
  },
  missed: {
    icon: AlertTriangleIcon,
    cls: "text-red-500",
    label: "Missed",
  },
};

export function MembersList({
  members,
  adminId,
  currentUserId,
  isAdmin,
  isShiftEnabled,
  memberActionLoadingId,
  onPause,
  onResume,
  onShift,
  onRemoveMember,
  isLoading,
}: MembersListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1">
            <Skeleton className="size-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {members.map((member) => {
        const statusMeta = STATUS_META[member.paymentStatus];
        const StatusIcon = statusMeta.icon;
        const initials = member.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        const isMe = member.uid === currentUserId;
        const isMemberAdmin = member.uid === adminId;

        return (
          <div
            key={member.uid}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
              isMe && "bg-primary/5",
            )}
          >
            {/* Position */}
            <span className="text-xs text-muted-foreground font-mono w-5 text-right shrink-0">
              #{member.turnPosition}
            </span>

            <Avatar size="sm" className="shrink-0">
              <AvatarImage src={member.avatarUrl} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">
                  {member.name}
                  {isMe && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      (you)
                    </span>
                  )}
                </p>
                {isMemberAdmin && (
                  <Crown className="size-3 text-amber-500 shrink-0" />
                )}
                {member.isCurrentRecipient && (
                  <Badge
                    variant="outline"
                    className="text-[9px] h-3.5 px-1 border-primary/40 text-primary shrink-0"
                  >
                    Next payout
                  </Badge>
                )}
                {member.isPaused && (
                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
                    Paused
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <StatusIcon className={cn("size-3", statusMeta.cls)} />
                <span className={cn("", statusMeta.cls)}>
                  {statusMeta.label}
                </span>
              </div>
            </div>

            {/* Admin actions */}
            {isAdmin && !isMemberAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <MoreHorizontalIcon className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {member.isPaused ? (
                    <DropdownMenuItem
                      onClick={() => onResume?.(member.uid)}
                      disabled={memberActionLoadingId === member.uid}
                    >
                      <CheckCircle2Icon className="size-4" />
                      Resume member
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() => onPause?.(member.uid)}
                      disabled={memberActionLoadingId === member.uid}
                    >
                      <ClockIcon className="size-4" />
                      Pause member
                    </DropdownMenuItem>
                  )}

                  {isShiftEnabled && (
                    <DropdownMenuItem
                      onClick={() => onShift?.(member.uid)}
                      disabled={memberActionLoadingId === member.uid}
                    >
                      <ArrowRightIcon className="size-4" />
                      Shift member
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onRemoveMember?.(member.uid)}
                    disabled={memberActionLoadingId === member.uid}
                  >
                    <UserXIcon className="size-4" />
                    Remove member
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
    </div>
  );
}
