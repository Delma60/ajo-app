"use client";

import { useEffect, useState } from "react";
import {
  Users,
  TrendingUp,
  CircleDollarSign,
  Calendar,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { doc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { StatCard, StatCardSkeleton, type StatCardData } from "@/components/dashboard/stat-card";
import { RecentTransactions, type DisplayTransaction } from "@/components/dashboard/recent-transactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatNaira } from "@/lib/utils";
import type { Wallet } from "@/lib/types/wallet";
import type { Circle } from "@/lib/types/circle";

// ─── Circle summary card ──────────────────────────────────────────────────────

function CircleSummaryCard({ circle }: { circle: Circle & { goal: number } }) {
  const progress = circle.goal > 0 ? Math.round((circle.saved / circle.goal) * 100) : 0;

  const progressColor =
    progress >= 80
      ? "bg-emerald-500"
      : progress >= 50
      ? "bg-amber-400"
      : "bg-blue-500";

  const statusColors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    paused: "bg-amber-100 text-amber-700",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    // TODO:: the circle.id is undefined
    <Link href={`/circles/${circle.id}`} className="block group">
      <Card size="sm" className="hover:ring-primary/30 transition-all hover:ring-2">
        <CardContent>
          {/* {JSON.stringify(circle)} */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {circle.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                {formatNaira(circle.contribution)} / cycle
              </p>
            </div>
            <Badge className={`text-[10px] h-5 shrink-0 ${statusColors[circle.status] ?? ""}`} variant="outline">
              {circle.status}
            </Badge>
          </div>
          {/* Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{formatNaira(circle.saved)} saved</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progressColor}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
            <span>{circle.memberIds?.length ?? 0}/{circle.maxMembers} members</span>
            <span>Cycle {circle.currentCycle}/{circle.totalCycles}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CircleSummarySkeleton() {
  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        <div className="flex justify-between gap-2">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main dashboard content ───────────────────────────────────────────────────

export function DashboardContent() {
  const { firebaseUser, appUser } = useAuthStore();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [circles, setCircles] = useState<(Circle & { goal: number })[]>([]);
  const [transactions, setTransactions] = useState<DisplayTransaction[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [circlesLoading, setCirclesLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(true);

  // Real-time wallet listener
  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = onSnapshot(
      doc(db, "wallets", firebaseUser.uid),
      (snap) => {
        if (snap.exists()) setWallet(snap.data() as Wallet);
        setWalletLoading(false);
      },
      () => setWalletLoading(false)
    );
    return () => unsub();
  }, [firebaseUser]);

  // Circles
  useEffect(() => {
    if (!firebaseUser || !appUser?.circleIds?.length) {
      setCirclesLoading(false);
      return;
    }
    const idsToFetch = appUser.circleIds.slice(0, 6);
    const unsub = onSnapshot(
      query(
        collection(db, "circles"),
        where("__name__", "in", idsToFetch)
      ),
      (snap) => {
        const data = snap.docs.map((d) => {
          const c = d.data() as Circle;
          return {
            ...c,
            goal: c.contribution * c.maxMembers, // derived — never stored
          };
        });
        setCircles(data);
        setCirclesLoading(false);
      },
      () => setCirclesLoading(false)
    );
    return () => unsub();
  }, [firebaseUser, appUser?.circleIds]);

  // Recent transactions
  useEffect(() => {
    if (!firebaseUser) return;
    const fetchTx = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "transactions"),
            where("userId", "==", firebaseUser.uid),
            orderBy("createdAt", "desc"),
            limit(5)
          )
        );
        const data: DisplayTransaction[] = snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            type: raw.type,
            direction: raw.direction,
            amount: raw.amount,
            status: raw.status,
            description: raw.description,
            createdAt: raw.createdAt?.toDate?.() ?? new Date(),
          };
        });
        setTransactions(data);
      } catch {
        // silently fail — empty state handles it
      } finally {
        setTxLoading(false);
      }
    };
    fetchTx();
  }, [firebaseUser]);

  const firstName = appUser?.name?.split(" ")[0] ?? "there";
  const totalSaved = wallet?.totalSaved ?? 0;
  const totalReceived = wallet?.totalReceived ?? 0;
  const activeCircleCount = circles.filter((c) => c.status === "active").length;
  const referralEarnings = wallet?.referralEarnings ?? 0;

  const stats: StatCardData[] = [
    {
      label: "Total Saved",
      value: formatNaira(totalSaved, true),
      icon: TrendingUp,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600",
      sub: "Lifetime",
    },
    {
      label: "Payouts Received",
      value: formatNaira(totalReceived, true),
      icon: CircleDollarSign,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600",
      sub: "Lifetime",
    },
    {
      label: "Active Circles",
      value: activeCircleCount.toString(),
      icon: Users,
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600",
      sub: `of ${circles.length} total`,
    },
    {
      label: "Referral Earnings",
      value: formatNaira(referralEarnings, true),
      icon: Sparkles,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600",
      sub: "From referrals",
    },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-5 space-y-6">

        {/* Greeting */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Good {getGreeting()}, {firstName} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Here&apos;s what&apos;s happening with your savings.
          </p>
        </div>

        {/* Balance card */}
        <BalanceCard wallet={wallet} isLoading={walletLoading} />

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {walletLoading || circlesLoading
            ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            : stats.map((s) => <StatCard key={s.label} data={s} />)}
        </div>

        {/* My Circles */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">My Circles</h2>
            <Button variant="ghost" size="sm" asChild className="text-xs text-muted-foreground gap-1 h-7">
              <Link href="/circles">
                View all <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>

          {circlesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 2 }).map((_, i) => <CircleSummarySkeleton key={i} />)}
            </div>
          ) : circles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted mb-3">
                <Users className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">You&apos;re not in any circles yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Create one or browse public circles to start saving together.
              </p>
              <div className="flex gap-2 mt-4">
                <Button size="sm" asChild>
                  <Link href="/circles/create">
                    <Plus className="size-3.5" />
                    Create Circle
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/circles/discover">Discover</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {circles.map((c) => (
                <CircleSummaryCard key={c.id} circle={c} />
              ))}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <RecentTransactions transactions={transactions} isLoading={txLoading} />
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}