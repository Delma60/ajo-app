"use client";

import { useState } from "react";
import {
  SearchIcon,
  Users2Icon,
  ChevronRightIcon,
  Loader2,
  SlidersHorizontalIcon,
  TicketIcon,
} from "lucide-react";
import { toast } from "sonner";
import { usePublicCircles, useJoinCircle } from "@/lib/hooks/use-circle";
import { useWallet } from "@/lib/hooks/use-wallet";
import { CircleCardSkeleton } from "@/components/circles/card";
import { JoinFeeConfirmDialog } from "@/components/circles/join-fee-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNaira, cn } from "@/lib/utils";
import { FREQ_LABELS, type CircleWithGoal } from "@/lib/types/circle";

// ─── Discover card ────────────────────────────────────────────────────────────

interface DiscoverCardProps {
  circle: CircleWithGoal;
  onJoin: (circle: CircleWithGoal) => void;
  isJoining: boolean;
  alreadyMember: boolean;
}

function DiscoverCard({
  circle,
  onJoin,
  isJoining,
  alreadyMember,
}: DiscoverCardProps) {
  const fillPct = Math.round(
    (circle.memberIds.length / circle.maxMembers) * 100,
  );
  const spotsLeft = circle.maxMembers - circle.memberIds.length;

  const progressColorCls =
    fillPct >= 80
      ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
      : fillPct >= 50
        ? "[&>[data-slot=progress-indicator]]:bg-amber-400"
        : "[&>[data-slot=progress-indicator]]:bg-blue-500";

  const hasFee = circle.joinFeeEnabled && circle.joinFee > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 hover:border-primary/40 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
            {circle.name}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {circle.description}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasFee && (
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-1.5 gap-1 border-primary/30 text-primary bg-primary/5"
            >
              <TicketIcon className="size-2.5" />
              {formatNaira(circle.joinFee)} fee
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            {FREQ_LABELS[circle.frequency]}
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span className="font-mono font-semibold text-foreground">
          {formatNaira(circle.contribution)}
        </span>
        <span className="text-muted-foreground">/cycle</span>
        <span>·</span>
        <span>
          {circle.memberIds.length}/{circle.maxMembers} members
        </span>
        <span>·</span>
        <span>Pool: {formatNaira(circle.goal)}</span>
      </div>

      {/* Tags */}
      {circle.tags?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {circle.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-[10px] h-4 px-1.5"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Progress */}
      <div className="space-y-1">
        <Progress value={fillPct} className={cn("h-1", progressColorCls)} />
        <p className="text-xs text-muted-foreground">
          {spotsLeft === 0
            ? "Circle is full"
            : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} remaining`}
        </p>
      </div>

      {/* Trust score + CTA */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div
            className={cn(
              "size-2 rounded-full",
              circle.trustScore >= 80
                ? "bg-emerald-500"
                : circle.trustScore >= 50
                  ? "bg-amber-400"
                  : "bg-red-500",
            )}
          />
          Trust score: {circle.trustScore}/100
        </div>
        {alreadyMember ? (
          <Badge variant="secondary" className="text-xs">
            Already a member
          </Badge>
        ) : (
          <Button
            size="sm"
            variant={spotsLeft === 0 ? "outline" : "default"}
            disabled={isJoining || spotsLeft === 0}
            onClick={() => onJoin(circle)}
            className="h-7"
          >
            {isJoining ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ChevronRightIcon className="size-3" />
            )}
            {spotsLeft === 0 ? "Full" : hasFee ? "View fee & join" : "Request to join"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main discover content ────────────────────────────────────────────────────

interface DiscoverCirclesContentProps {
  myCircleIds: string[];
}

export function DiscoverCirclesContent({
  myCircleIds,
}: DiscoverCirclesContentProps) {
  const [search, setSearch] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("members");

  // Join fee dialog state
  const [pendingJoinCircle, setPendingJoinCircle] =
    useState<CircleWithGoal | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const { data: circles, isLoading, error } = usePublicCircles(search);
  const { wallet } = useWallet();
  const joinCircle = useJoinCircle();

  // Called when user clicks the join button — shows fee dialog or joins directly
  function handleJoinClick(circle: CircleWithGoal) {
    const hasFee = circle.joinFeeEnabled && circle.joinFee > 0;
    if (hasFee) {
      // Show confirmation dialog first
      setPendingJoinCircle(circle);
    } else {
      // No fee — join directly
      executeJoin(circle.id);
    }
  }

  // Called either directly (no fee) or after user confirms fee dialog
  async function executeJoin(circleId: string, inviteCode?: string) {
    setJoiningId(circleId);
    setPendingJoinCircle(null);
    try {
      await joinCircle.mutateAsync({ circleId, inviteCode });
      toast.success("Join request sent! The admin will review your request.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send join request.",
      );
    } finally {
      setJoiningId(null);
    }
  }

  const filtered = (circles ?? [])
    .filter((c) =>
      frequencyFilter === "all" ? true : c.frequency === frequencyFilter,
    )
    .sort((a, b) => {
      if (sortBy === "members") return b.memberIds.length - a.memberIds.length;
      if (sortBy === "contribution") return b.contribution - a.contribution;
      if (sortBy === "trust") return b.trustScore - a.trustScore;
      return 0;
    });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-5 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold">Discover Circles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Find a public circle to join and start saving together.
          </p>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search circles by name or description…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
              <SelectTrigger className="w-[130px]">
                <SlidersHorizontalIcon className="size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All frequencies</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="members">Most members</SelectItem>
                <SelectItem value="contribution">
                  Highest contribution
                </SelectItem>
                <SelectItem value="trust">Trust score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CircleCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="py-10 text-center text-sm text-destructive">
            Failed to load circles. Please try refreshing.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted mb-4">
              <Users2Icon className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No circles found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search
                ? "Try adjusting your search or filters."
                : "No public circles are available right now."}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {filtered.length} circle{filtered.length !== 1 ? "s" : ""} found
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((circle) => (
                <DiscoverCard
                  key={circle.id}
                  circle={circle}
                  onJoin={handleJoinClick}
                  isJoining={joiningId === circle.id}
                  alreadyMember={myCircleIds.includes(circle.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Join fee confirmation dialog */}
      {pendingJoinCircle && (
        <JoinFeeConfirmDialog
          open={!!pendingJoinCircle}
          onOpenChange={(open) => !open && setPendingJoinCircle(null)}
          circleName={pendingJoinCircle.name}
          joinFeeKobo={pendingJoinCircle.joinFee}
          joinFeeType={pendingJoinCircle.joinFeeType}
          walletBalance={wallet?.available}
          onConfirm={() => executeJoin(pendingJoinCircle.id)}
          isLoading={joiningId === pendingJoinCircle.id}
        />
      )}
    </div>
  );
}