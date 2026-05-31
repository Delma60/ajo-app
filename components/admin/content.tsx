"use client";

import Link from "next/link";
import {
  Users,
  CircleDollarSign,
  TrendingUp,
  Gavel,
  ArrowDownLeft,
  ArrowUpRight,
  ReceiptText,
  Gift,
  AlertCircle,
  UserPlus,
  ShieldCheck,
  AlertTriangle,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNaira, cn } from "@/lib/utils";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminStats {
  totalUsers: number;
  activeCircles: number;
  totalTransactions: number;
  openDisputes: number;
  weeklyVolume: number;
  newUsersThisWeek: number;
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  subColor,
  icon: Icon,
  iconBg,
  iconColor,
  alert,
  isLoading,
}: {
  label: string;
  value: string;
  sub: string;
  subColor?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  alert?: boolean;
  isLoading: boolean;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        alert && "ring-1 ring-destructive/30",
      )}
    >
      <CardContent className="flex items-start justify-between gap-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <Icon className="size-3 shrink-0" />
            {label}
          </p>
          {isLoading ? (
            <Skeleton className="h-7 w-20 mt-1" />
          ) : (
            <p className="text-xl font-bold font-mono text-foreground leading-none">
              {value}
            </p>
          )}
          {isLoading ? (
            <Skeleton className="h-3 w-24 mt-2" />
          ) : (
            <p
              className="text-xs mt-1.5"
              style={subColor ? { color: subColor } : undefined}
            >
              {!subColor && (
                <span className="text-muted-foreground">{sub}</span>
              )}
              {subColor && sub}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            iconBg,
          )}
        >
          <Icon className={cn("size-4", iconColor)} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Recent user row ──────────────────────────────────────────────────────────

interface RecentUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  circleIds: string[];
  onboardingComplete: boolean;
  createdAt: any;
}

function UserRow({ user, index }: { user: RecentUser; index: number }) {
  const initials = (user.name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-purple-100 text-purple-700",
    "bg-amber-100 text-amber-700",
    "bg-pink-100 text-pink-700",
  ];

  const timeAgo = (ts: any): string => {
    if (!ts) return "recently";
    const date = ts?.toDate?.() ?? new Date(ts);
    const diff = Date.now() - date.getTime();
    const hrs = Math.floor(diff / 3_600_000);
    if (hrs < 1) return "just now";
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 last:pb-0">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback
          className={cn("text-xs font-medium", colors[index % colors.length])}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate leading-tight">
          {user.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
      <div className="text-right shrink-0 space-y-1">
        <p className="text-xs text-muted-foreground">
          {timeAgo(user.createdAt)}
        </p>
        <div className="flex items-center justify-end gap-1">
          <span className="text-xs text-muted-foreground">
            {user.circleIds?.length ?? 0} circle
            {(user.circleIds?.length ?? 0) !== 1 ? "s" : ""}
          </span>
          {!user.onboardingComplete && (
            <Badge variant="outline" className="text-[9px] h-4 px-1">
              setup pending
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────

interface AdminTransaction {
  id: string;
  type: string;
  direction: "credit" | "debit";
  amount: number;
  status: string;
  description: string;
  userId: string;
  createdAt: any;
}

const TX_ICON_MAP: Record<string, React.ElementType> = {
  deposit: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  contribution: Users,
  payout: CircleDollarSign,
  penalty: AlertCircle,
  referral_bonus: Gift,
  creation_fee: CircleDollarSign,
};

const TX_BG_MAP: Record<string, string> = {
  deposit: "bg-emerald-100 dark:bg-emerald-900/30",
  withdrawal: "bg-orange-100 dark:bg-orange-900/30",
  contribution: "bg-blue-100 dark:bg-blue-900/30",
  payout: "bg-emerald-100 dark:bg-emerald-900/30",
  penalty: "bg-red-100 dark:bg-red-900/30",
  referral_bonus: "bg-purple-100 dark:bg-purple-900/30",
  creation_fee: "bg-muted",
};

const TX_COLOR_MAP: Record<string, string> = {
  deposit: "text-emerald-600 dark:text-emerald-400",
  withdrawal: "text-orange-600 dark:text-orange-400",
  contribution: "text-blue-600 dark:text-blue-400",
  payout: "text-emerald-600 dark:text-emerald-400",
  penalty: "text-red-600 dark:text-red-400",
  referral_bonus: "text-purple-600 dark:text-purple-400",
  creation_fee: "text-muted-foreground",
};

function TxRow({ tx }: { tx: AdminTransaction }) {
  const Icon = TX_ICON_MAP[tx.type] ?? ReceiptText;
  const isCredit = tx.direction === "credit";

  const dateStr = tx.createdAt
    ? new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(tx.createdAt?.toDate?.() ?? new Date(tx.createdAt))
    : "—";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 last:pb-0">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          TX_BG_MAP[tx.type] ?? "bg-muted",
        )}
      >
        <Icon
          className={cn(
            "size-3.5",
            TX_COLOR_MAP[tx.type] ?? "text-muted-foreground",
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate leading-tight">
          {tx.description}
        </p>
        <p className="text-xs text-muted-foreground">{dateStr}</p>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <p
          className={cn(
            "text-sm font-semibold font-mono",
            isCredit
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground",
          )}
        >
          {isCredit ? "+" : "-"}
          {formatNaira(tx.amount)}
        </p>
        {tx.status !== "success" && (
          <Badge
            variant={tx.status === "pending" ? "secondary" : "destructive"}
            className="text-[10px] h-4"
          >
            {tx.status}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ─── Circle health row ────────────────────────────────────────────────────────

interface AdminCircle {
  id: string;
  name: string;
  memberIds: string[];
  maxMembers: number;
  trustScore: number;
  status: string;
  currentCycle: number;
  totalCycles: number;
}

function CircleHealthRow({ circle }: { circle: AdminCircle }) {
  const fillPct = Math.round(
    (circle.memberIds.length / circle.maxMembers) * 100,
  );

  const trustColor =
    circle.trustScore >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : circle.trustScore >= 55
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  const trustBarColor =
    circle.trustScore >= 80
      ? "[&>[data-slot=progress-indicator]]:bg-emerald-500"
      : circle.trustScore >= 55
        ? "[&>[data-slot=progress-indicator]]:bg-amber-400"
        : "[&>[data-slot=progress-indicator]]:bg-red-500";

  const statusDot =
    circle.status === "active"
      ? "bg-emerald-500"
      : circle.status === "paused"
        ? "bg-amber-400"
        : "bg-muted-foreground";

  return (
    <Link
      href={`/admin/circles`}
      className="block py-2.5 border-b border-border last:border-0 last:pb-0 hover:bg-muted/30 -mx-1 px-1 rounded transition-colors"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn("size-2 rounded-full shrink-0", statusDot)} />
        <p className="text-sm font-medium text-foreground flex-1 truncate leading-tight">
          {circle.name}
        </p>
        <span
          className={cn("text-xs font-semibold font-mono shrink-0", trustColor)}
        >
          {circle.trustScore}/100
        </span>
      </div>
      <div className="pl-4 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {circle.memberIds.length}/{circle.maxMembers} members · cycle{" "}
            {circle.currentCycle}/{circle.totalCycles}
          </span>
          <span>{fillPct}% full</span>
        </div>
        <Progress
          value={circle.trustScore}
          className={cn("h-1", trustBarColor)}
        />
      </div>
    </Link>
  );
}

// ─── Platform snapshot rows ───────────────────────────────────────────────────

function SnapshotRow({
  icon: Icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 last:pb-0">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground flex-1">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold font-mono",
          valueClass ?? "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminDashboardContent() {
  const {
    data: stats,
    error,
    isLoading,
  } = useSWR<AdminStats>("/api/admin/stats", fetcher);
  const { data: recentUsersData } = useSWR<{
    success: boolean;
    data: RecentUser[];
  }>("/api/admin/users?limit=5&orderBy=createdAt", fetcher);
  const { data: recentTxData } = useSWR<{
    success: boolean;
    data: AdminTransaction[];
  }>("/api/admin/transactions?limit=5", fetcher);
  const { data: circlesData } = useSWR<{
    success: boolean;
    data: AdminCircle[];
  }>("/api/admin/circles?limit=4&orderBy=trustScore", fetcher);

  const recentUsers: RecentUser[] = recentUsersData?.data ?? [];
  const recentTx: AdminTransaction[] = recentTxData?.data ?? [];
  const circles: AdminCircle[] = circlesData?.data ?? [];

  const hasDisputes = (stats?.openDisputes ?? 0) > 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Platform overview and real-time activity.
            </p>
          </div>
          {!isLoading && !error && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 shrink-0",
                hasDisputes
                  ? "border-destructive/30 bg-destructive/5 text-destructive"
                  : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/30",
              )}
            >
              {hasDisputes ? (
                <AlertTriangle className="size-3" />
              ) : (
                <ShieldCheck className="size-3" />
              )}
              {hasDisputes
                ? `${stats?.openDisputes} dispute${(stats?.openDisputes ?? 0) !== 1 ? "s" : ""} open`
                : "All systems healthy"}
            </Badge>
          )}
        </div>

        {/* Dispute alert banner */}
        {hasDisputes && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <AlertTriangle className="size-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive flex-1">
              <span className="font-semibold">
                {stats?.openDisputes} open dispute
                {(stats?.openDisputes ?? 0) !== 1 ? "s" : ""}
              </span>{" "}
              require your attention.
            </p>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="shrink-0 border-destructive/30 hover:bg-destructive/10 text-destructive"
            >
              <Link href="/admin/disputes">
                Review
                <ArrowRight className="size-3 ml-1" />
              </Link>
            </Button>
          </div>
        )}

        {/* Metric grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Total users"
            value={(stats?.totalUsers ?? 0).toLocaleString()}
            sub={`+${stats?.newUsersThisWeek ?? 0} this week`}
            icon={Users}
            iconBg="bg-blue-100 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
            isLoading={isLoading}
          />
          <MetricCard
            label="Active circles"
            value={(stats?.activeCircles ?? 0).toLocaleString()}
            sub="currently running"
            icon={CircleDollarSign}
            iconBg="bg-emerald-100 dark:bg-emerald-900/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
            isLoading={isLoading}
          />
          <MetricCard
            label="Weekly volume"
            value={formatNaira(stats?.weeklyVolume ?? 0, true)}
            sub="deposits · last 7 days"
            icon={TrendingUp}
            iconBg="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
            isLoading={isLoading}
          />
          <MetricCard
            label="Open disputes"
            value={(stats?.openDisputes ?? 0).toLocaleString()}
            sub={hasDisputes ? "needs review" : "all clear"}
            icon={Gavel}
            iconBg={hasDisputes ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"}
            iconColor={
              hasDisputes
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
            }
            alert={hasDisputes}
            isLoading={isLoading}
          />
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent signups */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserPlus className="size-4 text-muted-foreground" />
                Recent signups
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="ml-auto h-6 text-xs text-muted-foreground"
              >
                <Link href="/admin/users">
                  See all <ArrowRight className="size-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-3">
              {recentUsers.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="size-8 rounded-full shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-28" />
                            <Skeleton className="h-3 w-40" />
                          </div>
                          <Skeleton className="h-3 w-10" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    "No recent signups"
                  )}
                </div>
              ) : (
                <div>
                  {recentUsers.map((u, i) => (
                    <UserRow key={u.id} user={u} index={i} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent transactions */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ReceiptText className="size-4 text-muted-foreground" />
                Recent transactions
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="ml-auto h-6 text-xs text-muted-foreground"
              >
                <Link href="/admin/transactions">
                  See all <ArrowRight className="size-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-3">
              {recentTx.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <Skeleton className="size-8 rounded-lg shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                          <Skeleton className="h-4 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    "No recent transactions"
                  )}
                </div>
              ) : (
                <div>
                  {recentTx.map((tx) => (
                    <TxRow key={tx.id} tx={tx} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Circle health */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" />
                Circle health
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="ml-auto h-6 text-xs text-muted-foreground"
              >
                <Link href="/admin/circles">
                  Details <ArrowRight className="size-3 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-3">
              {circles.length === 0 ? (
                <div className="py-8">
                  {isLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex gap-2">
                            <Skeleton className="size-2 rounded-full mt-1.5 shrink-0" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-4 w-12" />
                          </div>
                          <Skeleton className="h-1.5 w-full rounded-full ml-4" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">
                      No circles found
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  {circles.map((c) => (
                    <CircleHealthRow key={c.id} circle={c} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Platform snapshot */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="size-4 text-muted-foreground" />
                Platform snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="size-7 rounded-lg shrink-0" />
                      <Skeleton className="h-3.5 flex-1" />
                      <Skeleton className="h-3.5 w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <SnapshotRow
                    icon={ReceiptText}
                    label="Total transactions"
                    value={(stats?.totalTransactions ?? 0).toLocaleString()}
                  />
                  <SnapshotRow
                    icon={UserPlus}
                    label="New users this week"
                    value={`+${stats?.newUsersThisWeek ?? 0}`}
                    valueClass="text-emerald-600 dark:text-emerald-400"
                  />
                  <SnapshotRow
                    icon={TrendingUp}
                    label="Weekly deposit volume"
                    value={formatNaira(stats?.weeklyVolume ?? 0, true)}
                    valueClass="text-blue-600 dark:text-blue-400"
                  />
                  <SnapshotRow
                    icon={CircleDollarSign}
                    label="Active circles"
                    value={(stats?.activeCircles ?? 0).toLocaleString()}
                  />
                  <SnapshotRow
                    icon={Gavel}
                    label="Open disputes"
                    value={(stats?.openDisputes ?? 0).toLocaleString()}
                    valueClass={hasDisputes ? "text-destructive" : undefined}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
