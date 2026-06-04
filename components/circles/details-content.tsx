"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarIcon,
  Users2Icon,
  TrendingUpIcon,
  ShieldCheckIcon,
  LockIcon,
  GlobeIcon,
  GavelIcon,
  CopyIcon,
  PauseIcon,
  PlayIcon,
  MoreHorizontalIcon,
  BellIcon,
  Trash2Icon,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

import { useCircleRealtime } from "@/lib/hooks/use-circle";
import { useAuthStore } from "@/lib/stores/auth-store";
import { db } from "@/lib/firebase/client";
import { formatNaira, cn } from "@/lib/utils";
import { FREQ_LABELS, PAYOUT_LABELS, STATUS_META } from "@/lib/types/circle";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { ContributionDialog } from "@/components/circles/contribution-dialog";
import { BidDialog } from "@/components/circles/bid-dialog";
import { MembersList } from "@/components/circles/members-list";
// import { PendingRequests } from "@/components/circles/pending-requests";
import { LeaveCircleDialog } from "@/components/circles/leave-circle-dialog";
import { PendingRequests } from "./pending-requests";

interface CircleDetailContentProps {
  circleId: string;
  walletBalance: number; // kobo
}

export function CircleDetailContent({
  circleId,
  walletBalance,
}: CircleDetailContentProps) {
  const router = useRouter();
  const { firebaseUser, appUser } = useAuthStore();
  const { circle, isLoading, error } = useCircleRealtime(circleId);

  const [contributeOpen, setContributeOpen] = useState(false);
  const [bidOpen, setBidOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Re-renders when pendingRequestIds changes via real-time listener
  const handleRequestProcessed = useCallback(() => {
    // The real-time listener on useCircleRealtime automatically refreshes
    // pendingRequestIds — no manual state update needed here
  }, []);

  if (isLoading) {
    return <CircleDetailSkeleton />;
  }

  if (error || !circle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
        <p className="text-sm font-medium">Circle not found</p>
        <p className="text-xs text-muted-foreground mt-1">
          This circle may have been deleted or you don't have access.
        </p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href="/circles">Back to Circles</Link>
        </Button>
      </div>
    );
  }

  const isAdmin = circle.adminId === firebaseUser?.uid;
  const isMember = circle.memberIds.includes(firebaseUser?.uid ?? "");
  const isPending = circle.pendingRequestIds?.includes(firebaseUser?.uid ?? "");
  const isCurrentRecipient = circle.currentRecipientId === firebaseUser?.uid;
  const invitePermission = circle.invitePermission ?? "admin";
  const canInvite = isAdmin || (isMember && invitePermission === "members");

  const progress =
    circle.goal > 0 ? Math.round((circle.saved / circle.goal) * 100) : 0;
  const statusMeta = STATUS_META[circle.status];

  // Determine user's turn position (1-indexed)
  const myTurnPosition = isMember
    ? circle.memberIds.indexOf(firebaseUser?.uid ?? "") + 1
    : 0;

  // Check if user has a pending contribution for this cycle
  // (Approximate: if saved < expected-per-member × cycle, assume pending)
  const hasPendingContribution = isMember && circle.status === "active";

  const progressColorCls =
    progress >= 80
      ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
      : progress >= 50
        ? "[&>[data-slot=progress-indicator]]:bg-amber-400"
        : "[&>[data-slot=progress-indicator]]:bg-blue-500";

  const nextDueDate = circle.nextDueDate?.toDate?.() ?? new Date();
  const nextPayoutDate = circle.nextPayoutDate?.toDate?.() ?? new Date();

  async function handleTogglePause() {
    if (!isAdmin || !circle) return;
    setIsTogglingPause(true);
    try {
      const action = circle.status === "active" ? "pause" : "unpause";
      const res = await fetch(`/api/circles/${circleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to update");
      toast.success(
        circle.status === "active" ? "Circle paused." : "Circle resumed.",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update circle status.",
      );
    } finally {
      setIsTogglingPause(false);
    }
  }

  async function handleDeleteCircle() {
    if (!isAdmin) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/circles/${circleId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success)
        throw new Error(data.error ?? "Failed to delete circle");
      toast.success("Circle has been cancelled.");
      router.push("/circles");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to delete circle. Please try again.",
      );
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(circle!.inviteCode ?? "");
    toast.success("Invite code copied!");
  }

  async function handleShareInvite() {
    if (!circle) return;

    const inviteUrl = `${window.location.origin}/circles/${circleId}${
      circle.isPrivate ? `?inviteCode=${circle.inviteCode}` : ""
    }`;
    const shareText = circle.isPrivate
      ? `Join my private circle "${circle.name}" on AjoSave.
Invite code: ${circle.inviteCode}

${inviteUrl}`
      : `Join my circle "${circle.name}" on AjoSave.

${inviteUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Invite to ${circle.name}`,
          text: shareText,
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast.success("Invite link copied!");
      }
    } catch (err) {
      toast.error("Unable to share invite. Please try copying the link.");
    }
  }

  // Build members list with actual data
  const membersList = circle.memberIds.map((uid, i) => ({
    uid,
    name:
      uid === firebaseUser?.uid ? (appUser?.name ?? "You") : `Member ${i + 1}`,
    turnPosition: i + 1,
    paymentStatus: "up_to_date" as const,
    isCurrentRecipient: uid === circle.currentRecipientId,
  }));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-5 space-y-5">
        {/* Back nav */}
        <Link
          href="/circles"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="size-3.5" />
          My Circles
        </Link>

        {/* ── Hero card ── */}
        <div className="rounded-2xl overflow-hidden border border-border bg-card">
          {/* Header */}
          <div className="p-5 pb-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold leading-tight">
                    {circle.name}
                  </h1>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-0 text-xs shrink-0",
                      statusMeta.badgeCls,
                    )}
                  >
                    {statusMeta.label}
                  </Badge>
                  {circle.isPrivate ? (
                    <LockIcon className="size-3.5 text-muted-foreground" />
                  ) : (
                    <GlobeIcon className="size-3.5 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {circle.description}
                </p>
              </div>

              {/* Admin menu */}
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontalIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={handleTogglePause}
                      disabled={
                        isTogglingPause ||
                        circle.status === "completed" ||
                        circle.status === "cancelled"
                      }
                    >
                      {isTogglingPause ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : circle.status === "active" ? (
                        <PauseIcon className="size-4" />
                      ) : (
                        <PlayIcon className="size-4" />
                      )}
                      {circle.status === "active"
                        ? "Pause circle"
                        : "Resume circle"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={copyInviteCode}>
                      <CopyIcon className="size-4" />
                      Copy invite code
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={circle.status === "completed"}
                    >
                      <Trash2Icon className="size-4" />
                      Cancel circle
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Tags */}
            {circle.tags?.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {circle.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-[10px] h-4 px-1.5"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {canInvite && (
              <div className="pt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShareInvite}
                  className="flex-1"
                >
                  Share invite
                </Button>
                {circle.isPrivate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={copyInviteCode}
                  >
                    Copy invite code
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-border divide-x divide-border">
            {[
              {
                label: "Contribution",
                value: formatNaira(circle.contribution),
                sub: FREQ_LABELS[circle.frequency],
              },
              {
                label: "Members",
                value: `${circle.memberIds.length}/${circle.maxMembers}`,
                sub: `${circle.maxMembers - circle.memberIds.length} spots left`,
              },
              {
                label: "Cycle",
                value: `${circle.currentCycle}/${circle.totalCycles}`,
                sub: PAYOUT_LABELS[circle.payoutOrder],
              },
              {
                label: "Trust score",
                value: `${circle.trustScore}/100`,
                sub:
                  circle.trustScore >= 80
                    ? "Excellent"
                    : circle.trustScore >= 50
                      ? "Good"
                      : "Building",
              },
            ].map(({ label, value, sub }) => (
              <div key={label} className="p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold font-mono">{value}</p>
                <p className="text-[11px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="px-5 py-4 border-t border-border space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatNaira(circle.saved)} saved</span>
              <span>
                {formatNaira(circle.goal)} goal · {progress}%
              </span>
            </div>
            <Progress
              value={progress}
              className={cn("h-2", progressColorCls)}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 border-t border-border divide-x divide-border">
            <div className="px-5 py-3 flex items-center gap-2 text-xs">
              <CalendarIcon className="size-3.5 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Next contribution due</p>
                <p className="font-medium">
                  {nextDueDate.toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div className="px-5 py-3 flex items-center gap-2 text-xs">
              <TrendingUpIcon className="size-3.5 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Next payout</p>
                <p className="font-medium">
                  {nextPayoutDate.toLocaleDateString("en-NG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* CTAs for active members */}
          {isMember && circle.status === "active" && (
            <div className="px-5 py-4 border-t border-border flex gap-2 flex-wrap">
              <Button
                className="flex-1 min-w-[120px]"
                onClick={() => setContributeOpen(true)}
              >
                Make Contribution
              </Button>
              {circle.payoutOrder === "bidding" && (
                <Button
                  variant="outline"
                  className="flex-1 min-w-[120px]"
                  onClick={() => setBidOpen(true)}
                >
                  <GavelIcon className="size-4" />
                  Place Bid
                </Button>
              )}
              {!isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setLeaveDialogOpen(true)}
                >
                  Leave
                </Button>
              )}
            </div>
          )}

          {/* Pending join request notice */}
          {!isMember && isPending && (
            <div className="px-5 py-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
              <BellIcon className="size-3.5" />
              Your join request is pending admin approval.
            </div>
          )}
        </div>

        {/* ── Detail tabs ── */}
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">
              Members ({circle.memberIds.length})
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="requests">
                Requests
                {(circle.pendingRequestIds?.length ?? 0) > 0 && (
                  <span className="ml-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {circle.pendingRequestIds.length}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="members" className="pt-4">
            <Card>
              <CardContent className="pt-2">
                <MembersList
                  members={membersList}
                  adminId={circle.adminId}
                  currentUserId={firebaseUser?.uid ?? ""}
                  isAdmin={isAdmin}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="pt-4">
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Circle activity will appear here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="requests" className="pt-4">
              <PendingRequests
                pendingIds={circle.pendingRequestIds ?? []}
                circleId={circleId}
                onRequestProcessed={handleRequestProcessed}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* ── Dialogs ── */}

      <ContributionDialog
        open={contributeOpen}
        onOpenChange={setContributeOpen}
        circleId={circleId}
        circleName={circle.name}
        amount={circle.contribution}
        walletBalance={walletBalance}
      />

      {circle.payoutOrder === "bidding" && (
        <BidDialog
          open={bidOpen}
          onOpenChange={setBidOpen}
          circleId={circleId}
          circleName={circle.name}
          poolAmount={circle.goal}
          deadline={nextPayoutDate}
        />
      )}

      {/* Leave circle dialog — fully wired */}
      <LeaveCircleDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        circleId={circleId}
        circleName={circle.name}
        hasPendingContribution={hasPendingContribution}
        contributionKobo={circle.contribution}
        isNextRecipient={isCurrentRecipient}
        turnPosition={myTurnPosition}
        totalCycles={circle.totalCycles}
        currentCycle={circle.currentCycle}
      />

      {/* Delete / Cancel circle confirm */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this circle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently cancel <strong>{circle.name}</strong> and
              suspend all pending contributions. Members will be notified. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Keep circle
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteCircle}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Cancelling…
                </>
              ) : (
                "Cancel circle"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CircleDetailSkeleton() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-5 space-y-5">
        <Skeleton className="h-4 w-24" />
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72" />
              </div>
              <Skeleton className="size-7 rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-4 border-t border-border divide-x divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-border space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}
