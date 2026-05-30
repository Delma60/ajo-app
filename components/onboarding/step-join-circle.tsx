"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  Users2Icon,
  PlusCircleIcon,
  TrendingUpIcon,
  CalendarIcon,
  Loader2,
  ChevronRightIcon,
  SearchIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatNaira } from "@/lib/utils";
import { useAuth } from "@/lib/hooks/use-auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicCircle {
  id: string;
  name: string;
  description: string;
  contribution: number; // kobo
  frequency: string;
  maxMembers: number;
  memberIds: string[];
  trustScore: number;
  tags: string[];
}

// ─── Circle card skeleton ─────────────────────────────────────────────────────

function CircleCardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-1 w-full rounded-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Circle card ──────────────────────────────────────────────────────────────

interface CircleCardProps {
  circle: PublicCircle;
  onJoin: (id: string) => void;
  isJoining: boolean;
}

const FREQ_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  "bi-weekly": "Bi-weekly",
  monthly: "Monthly",
};

function CircleCard({ circle, onJoin, isJoining }: CircleCardProps) {
  const fillPct = Math.round((circle.memberIds.length / circle.maxMembers) * 100);
  const spotsLeft = circle.maxMembers - circle.memberIds.length;

  return (
    <div className="rounded-xl border border-border bg-background p-4 space-y-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{circle.name}</p>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {circle.description}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 text-xs">
          {FREQ_LABELS[circle.frequency] ?? circle.frequency}
        </Badge>
      </div>

      {/* Contribution + members */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <TrendingUpIcon className="size-3 text-primary" />
          <span className="font-mono font-medium text-foreground">
            {formatNaira(circle.contribution)}
          </span>
          /cycle
        </span>
        <span className="flex items-center gap-1">
          <Users2Icon className="size-3" />
          {circle.memberIds.length}/{circle.maxMembers} members
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress
          value={fillPct}
          className={cn(
            "h-1",
            fillPct >= 80
              ? "[&>[data-slot=progress-indicator]]:bg-[var(--success,#10b981)]"
              : fillPct >= 50
                ? "[&>[data-slot=progress-indicator]]:bg-[var(--warning,#f59e0b)]"
                : ""
          )}
        />
        <p className="text-xs text-muted-foreground">
          {spotsLeft === 0 ? "Circle full" : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`}
        </p>
      </div>

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled={isJoining || spotsLeft === 0}
        onClick={() => onJoin(circle.id)}
      >
        {isJoining ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ChevronRightIcon className="size-3.5" />
        )}
        {spotsLeft === 0 ? "Full" : "Request to join"}
      </Button>
    </div>
  );
}

// ─── Main step component ──────────────────────────────────────────────────────

interface StepJoinCircleProps {
  onComplete: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export function StepJoinCircle({
  onComplete,
  onSkip,
  onBack,
}: StepJoinCircleProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const { data: circles, isLoading } = useQuery<PublicCircle[]>({
    queryKey: ["public-circles"],
    queryFn: async () => {
      const res = await fetch("/api/circles");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data ?? [];
    },
  });

  const filtered = circles?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  async function handleJoin(circleId: string) {
    if (!user) return;
    setJoiningId(circleId);
    try {
      const res = await fetch(`/api/circles/${circleId}/join`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to join circle");
      toast.success("Join request sent! The admin will review your request.");
      onComplete();
    } catch (err) {
      console.error(err);
      toast.error("Could not send join request. Please try again.");
    } finally {
      setJoiningId(null);
    }
  }

  function handleCreateCircle() {
    // Mark onboarding as complete, then redirect to create
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        onboardingComplete: true,
        updatedAt: serverTimestamp(),
      }).catch(console.error);
    }
    router.push("/circles/create");
  }

  return (
    <div className="bg-card ring-1 ring-foreground/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-8 pb-0 space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Join a circle</h2>
        <p className="text-sm text-muted-foreground">
          Browse public circles or create your own to start your savings journey.
        </p>
      </div>

      <Tabs defaultValue="browse" className="p-8 pt-5">
        <TabsList className="w-full mb-5">
          <TabsTrigger value="browse" className="flex-1">
            Browse circles
          </TabsTrigger>
          <TabsTrigger value="create" className="flex-1">
            Create one
          </TabsTrigger>
        </TabsList>

        {/* Browse tab */}
        <TabsContent value="browse" className="space-y-4 mt-0">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search circles…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1 -mr-1">
            {isLoading ? (
              <>
                <CircleCardSkeleton />
                <CircleCardSkeleton />
              </>
            ) : !filtered?.length ? (
              <div className="text-center py-10 space-y-2">
                <Users2Icon className="size-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  {search ? "No circles match your search." : "No public circles available right now."}
                </p>
              </div>
            ) : (
              filtered.map((circle) => (
                <CircleCard
                  key={circle.id}
                  circle={circle}
                  onJoin={handleJoin}
                  isJoining={joiningId === circle.id}
                />
              ))
            )}
          </div>
        </TabsContent>

        {/* Create tab */}
        <TabsContent value="create" className="mt-0">
          <div className="rounded-xl border border-border bg-muted/30 p-6 text-center space-y-4">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <PlusCircleIcon className="size-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-sm">Start your own circle</p>
              <p className="text-xs text-muted-foreground">
                Set your own contribution amount, frequency, and invite people you trust.
                A creation fee of 5% of your contribution amount applies.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-left">
              {[
                { icon: Users2Icon, label: "Up to unlimited members" },
                { icon: CalendarIcon, label: "Daily to monthly cycles" },
                { icon: TrendingUpIcon, label: "Rotational or bidding payout" },
                { icon: CalendarIcon, label: "You control the schedule" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="size-3.5 text-primary shrink-0" />
                  {label}
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={handleCreateCircle}>
              Create a circle
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer actions */}
      <div className="px-8 pb-8 space-y-3">
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={onSkip}
        >
          Skip for now — I'll join a circle later
        </Button>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back to wallet
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-6">
        Step 3 of 3 — Join a Circle
      </p>
    </div>
  );
}