"use client";

import {
  Users,
  CircleDollarSign,
  ArrowLeftRight,
  Gavel,
  TrendingUp,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/utils";

interface Stats {
  totalUsers: number;
  activeCircles: number;
  totalTransactions: number;
  openDisputes: number;
  weeklyVolume: number;
  newUsersThisWeek: number;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? "ring-1 ring-destructive/20" : ""}>
      <CardContent className="flex items-start justify-between gap-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="mt-1 text-xl font-bold font-mono text-foreground leading-none">
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p>
          )}
        </div>
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          <Icon className={`size-4 ${iconColor}`} />
        </div>
      </CardContent>
    </Card>
  );
}

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function AdminDashboardContent() {
  const {
    data: stats,
    error,
    isLoading,
  } = useSWR<Stats>("/api/admin/stats", fetcher);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading stats...
      </div>
    );
  }
  if (error || !stats) {
    return (
      <div className="p-8 text-center text-destructive">
        Failed to load stats.
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      sub: `+${stats.newUsersThisWeek} this week`,
      icon: Users,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Active Circles",
      value: stats.activeCircles.toLocaleString(),
      sub: "Currently running",
      icon: CircleDollarSign,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Weekly Volume",
      value: formatNaira(stats.weeklyVolume, true),
      sub: "Deposits (last 7 days)",
      icon: TrendingUp,
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Open Disputes",
      value: stats.openDisputes.toLocaleString(),
      sub: stats.openDisputes > 0 ? "Needs review" : "All clear",
      icon: Gavel,
      iconBg:
        stats.openDisputes > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-muted",
      iconColor:
        stats.openDisputes > 0
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground",
      alert: stats.openDisputes > 0,
    },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Platform overview and key metrics.
            </p>
          </div>
          <Badge
            variant="secondary"
            className="gap-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0"
          >
            <CheckCircle2 className="size-3" />
            System healthy
          </Badge>
        </div>

        {/* Alert if open disputes */}
        {stats.openDisputes > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <AlertTriangle className="size-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">
              <span className="font-semibold">
                {stats.openDisputes} open dispute
                {stats.openDisputes !== 1 ? "s" : ""}
              </span>{" "}
              require{stats.openDisputes === 1 ? "s" : ""} your attention.{" "}
              <a
                href="/admin/disputes"
                className="underline underline-offset-3 font-medium"
              >
                Review now →
              </a>
            </p>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>

        {/* Quick links */}
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-4">
            {[
              { label: "View all users", href: "/admin/users", icon: Users },
              {
                label: "Active circles",
                href: "/admin/circles",
                icon: CircleDollarSign,
              },
              {
                label: "Transactions",
                href: "/admin/transactions",
                icon: ArrowLeftRight,
              },
              { label: "Open disputes", href: "/admin/disputes", icon: Gavel },
            ].map(({ label, href, icon: Icon }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </a>
            ))}
          </CardContent>
        </Card>

        {/* Platform stats */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold font-mono text-foreground">
                {stats.totalTransactions.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Total transactions
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {stats.newUsersThisWeek}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                New users this week
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold font-mono text-foreground">
                {stats.activeCircles}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Active savings circles
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
