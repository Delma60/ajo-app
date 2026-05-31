"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  CheckIcon,
  XIcon,
  Loader2,
  Users2Icon,
  ClockIcon,
  UserCircle2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PendingUser {
  uid: string;
  name: string;
  email: string;
  avatarUrl?: string;
  phone?: string;
  circleCount?: number;
}

interface PendingRequestsProps {
  pendingIds: string[];
  circleId: string;
  onRequestProcessed?: () => void;
}

function RequestRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <Skeleton className="size-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="flex gap-2 shrink-0">
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
    </div>
  );
}

function RequestRow({
  user,
  circleId,
  onApprove,
  onDecline,
  isProcessing,
}: {
  user: PendingUser;
  circleId: string;
  onApprove: (uid: string) => void;
  onDecline: (uid: string) => void;
  isProcessing: boolean;
}) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-border last:border-0">
      <Avatar className="size-10 shrink-0">
        <AvatarImage src={user.avatarUrl} />
        <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">
            {user.name}
          </p>
          {user.circleCount !== undefined && user.circleCount > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] h-4 px-1.5 shrink-0"
            >
              {user.circleCount} circle{user.circleCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {user.email}
          {user.phone && (
            <span className="text-muted-foreground/60 ml-2">· {user.phone}</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
          disabled={isProcessing}
          onClick={() => onDecline(user.uid)}
        >
          {isProcessing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <XIcon className="size-3" />
          )}
          Decline
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          disabled={isProcessing}
          onClick={() => onApprove(user.uid)}
        >
          {isProcessing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <CheckIcon className="size-3" />
          )}
          Approve
        </Button>
      </div>
    </div>
  );
}

export function PendingRequests({
  pendingIds,
  circleId,
  onRequestProcessed,
}: PendingRequestsProps) {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch user details for all pending request IDs
  useEffect(() => {
    if (pendingIds.length === 0) {
      setPendingUsers([]);
      setIsLoadingUsers(false);
      return;
    }

    setIsLoadingUsers(true);

    async function fetchUsers() {
      try {
        // Batch fetch up to 30 users (Firestore "in" limit)
        const ids = pendingIds.slice(0, 30);
        const userDocs = await getDocs(
          query(
            collection(db, "users"),
            where("__name__", "in", ids)
          )
        );

        const users: PendingUser[] = await Promise.all(
          userDocs.docs.map(async (d) => {
            const data = d.data();
            return {
              uid: d.id,
              name: data.name ?? "Unknown User",
              email: data.email ?? "",
              avatarUrl: data.avatarUrl,
              phone: data.phone,
              circleCount: (data.circleIds ?? []).length,
            };
          })
        );

        // Preserve the order from pendingIds
        const ordered = ids
          .map((id) => users.find((u) => u.uid === id))
          .filter(Boolean) as PendingUser[];

        setPendingUsers(ordered);
      } catch (err) {
        console.error("[PendingRequests] Failed to fetch users:", err);
        // Fallback: show placeholder entries
        setPendingUsers(
          pendingIds.map((uid) => ({
            uid,
            name: `User ${uid.slice(0, 6)}…`,
            email: "",
          }))
        );
      } finally {
        setIsLoadingUsers(false);
      }
    }

    fetchUsers();
  }, [pendingIds]);

  async function handleAction(userId: string, action: "approve" | "decline") {
    setProcessingId(userId);
    try {
      const res = await fetch(`/api/circles/${circleId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error ?? "Request failed");
      }

      const user = pendingUsers.find((u) => u.uid === userId);
      const userName = user?.name ?? "The user";

      if (action === "approve") {
        toast.success(`${userName} has been approved and added to the circle.`);
      } else {
        toast.success(`${userName}'s request has been declined.`);
      }

      // Remove from local list immediately (optimistic)
      setPendingUsers((prev) => prev.filter((u) => u.uid !== userId));
      onRequestProcessed?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to process request. Please try again."
      );
    } finally {
      setProcessingId(null);
    }
  }

  if (pendingIds.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted mx-auto mb-3">
            <Users2Icon className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No pending requests</p>
          <p className="text-xs text-muted-foreground mt-1">
            When members request to join, they'll appear here for your review.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <ClockIcon className="size-4 text-amber-500" />
          Pending Requests
          <Badge variant="secondary" className="ml-auto text-xs font-semibold">
            {pendingIds.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-4 pb-3 border-b border-border">
          Review each request before approving. Approved members are immediately added to the circle.
        </p>

        {isLoadingUsers ? (
          <div>
            {Array.from({ length: Math.min(pendingIds.length, 3) }).map((_, i) => (
              <RequestRowSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div>
            {pendingUsers.map((user) => (
              <RequestRow
                key={user.uid}
                user={user}
                circleId={circleId}
                onApprove={(uid) => handleAction(uid, "approve")}
                onDecline={(uid) => handleAction(uid, "decline")}
                isProcessing={processingId === user.uid}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}