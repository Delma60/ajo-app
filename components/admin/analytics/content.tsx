"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  TrendingUpIcon,
  UsersIcon,
  CircleDollarSignIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ShieldCheckIcon,
  BarChart3Icon,
  RefreshCwIcon,
  AlertCircleIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Range = "7d" | "30d" | "90d" | "12m";

interface DepositBucket {
  label: string;
  deposits: number;
  withdrawals: number;
  net: number;
}

interface UserGrowthBucket {
  label: string;
  total: number;
  new: number;
}

interface CircleBucket {
  label: string;
  created: number;
}

interface TxBreakdown {
  type: string;
  count: number;
  volumeNaira: number;
}

interface TopCircle {
  id: string;
  name: string;
  trustScore: number;
  memberCount: number;
  maxMembers: number;
  contribution: number;
  frequency: string;
  currentCycle: number;
  totalCycles: number;
}

interface RetentionStats {
  totalUsers: number;
  onboardingCompletionRate: number;
  activeUserRate: number;
  circleParticipationRate: number;
  onboardingComplete: number;
  activeUsers: number;
  usersInCircles: number;
}

interface AnalyticsData {
  range: Range;
  depositSeries: DepositBucket[];
  userGrowthSeries: UserGrowthBucket[];
  circleSeries: CircleBucket[];
  transactionBreakdown: TxBreakdown[];
  topCircles: TopCircle[];
  retentionStats: RetentionStats;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RANGE_OPTIONS: { label: string; value: Range }[] = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "12 months", value: "12m" },
];

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposits",
  withdrawal: "Withdrawals",
  contribution: "Contributions",
  payout: "Payouts",
  penalty: "Penalties",
  referral_bonus: "Referral Bonuses",
  creation_fee: "Creation Fees",
};

const PIE_COLORS = [
  "#047857",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmtNaira(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}k`;
  return `₦${n.toLocaleString()}`;
}

// ─── KPI pill ─────────────────────────────────────────────────────────────────

function KpiPill({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  isLoading,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trend?: "up" | "down" | "neutral";
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-24 mt-1" />
            </>
          ) : (
            <>
              <p className="text-xl font-bold font-mono leading-none">
                {value}
              </p>
              <p
                className={cn(
                  "text-xs mt-1",
                  trend === "up" && "text-emerald-600 dark:text-emerald-400",
                  trend === "down" && "text-red-500",
                  (!trend || trend === "neutral") && "text-muted-foreground",
                )}
              >
                {sub}
              </p>
            </>
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

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, naira = false }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {naira ? fmtNaira(p.value) : p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircleIcon className="size-5 text-destructive" />
      </div>
      <div>
        <p className="text-sm font-medium">Failed to load analytics</p>
        <p className="text-xs text-muted-foreground mt-1">
          Check your connection and try again.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
        <RefreshCwIcon className="size-3.5" />
        Retry
      </Button>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 pb-3 border-b">
      <div>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && (
          <CardDescription className="text-xs mt-0.5">
            {description}
          </CardDescription>
        )}
      </div>
      {badge && (
        <Badge variant="secondary" className="text-xs shrink-0">
          {badge}
        </Badge>
      )}
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

export function AnalyticsContent() {
  const [range, setRange] = useState<Range>("30d");

  const {
    data: resp,
    error,
    isLoading,
    mutate,
  } = useSWR<{ success: boolean; data: AnalyticsData }>(
    `/api/admin/analytics?range=${range}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const d = resp?.data;
  const hasError = !!error || (resp && !resp.success);

  // ── KPI summaries computed from series ────────────────────────────────────
  const totalDepositsNaira =
    d?.depositSeries.reduce((s, b) => s + b.deposits, 0) ?? 0;
  const totalWithdrawalsNaira =
    d?.depositSeries.reduce((s, b) => s + b.withdrawals, 0) ?? 0;
  const totalNewUsers = d?.userGrowthSeries.reduce((s, b) => s + b.new, 0) ?? 0;
  const totalCirclesCreated =
    d?.circleSeries.reduce((s, b) => s + b.created, 0) ?? 0;

  // ── Retention gauges ──────────────────────────────────────────────────────
  const retentionGauges = d
    ? [
        {
          label: "Onboarding completion",
          value: d.retentionStats.onboardingCompletionRate,
          count: d.retentionStats.onboardingComplete,
          color: "bg-emerald-500",
        },
        {
          label: "Active user rate",
          value: d.retentionStats.activeUserRate,
          count: d.retentionStats.activeUsers,
          color: "bg-blue-500",
        },
        {
          label: "Circle participation",
          value: d.retentionStats.circleParticipationRate,
          count: d.retentionStats.usersInCircles,
          color: "bg-purple-500",
        },
      ]
    : [];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <BarChart3Icon className="size-5 text-muted-foreground" />
              Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Platform activity, growth trends, and financial overview.
            </p>
          </div>

          {/* Range selector */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  range === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {hasError ? (
          <ErrorState onRetry={() => mutate()} />
        ) : (
          <>
            {/* ── KPI pills ── */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiPill
                label="Total deposits"
                value={fmtNaira(totalDepositsNaira)}
                sub={`${range} period`}
                icon={ArrowDownLeftIcon}
                iconBg="bg-emerald-100 dark:bg-emerald-900/30"
                iconColor="text-emerald-600 dark:text-emerald-400"
                trend="up"
                isLoading={isLoading}
              />
              <KpiPill
                label="Total withdrawals"
                value={fmtNaira(totalWithdrawalsNaira)}
                sub={`${range} period`}
                icon={ArrowUpRightIcon}
                iconBg="bg-orange-100 dark:bg-orange-900/30"
                iconColor="text-orange-600 dark:text-orange-400"
                isLoading={isLoading}
              />
              <KpiPill
                label="New users"
                value={totalNewUsers.toLocaleString()}
                sub={`${range} signups`}
                icon={UsersIcon}
                iconBg="bg-blue-100 dark:bg-blue-900/30"
                iconColor="text-blue-600 dark:text-blue-400"
                trend="up"
                isLoading={isLoading}
              />
              <KpiPill
                label="Circles created"
                value={totalCirclesCreated.toLocaleString()}
                sub={`${range} period`}
                icon={CircleDollarSignIcon}
                iconBg="bg-purple-100 dark:bg-purple-900/30"
                iconColor="text-purple-600 dark:text-purple-400"
                isLoading={isLoading}
              />
            </div>

            {/* ── Volume chart + User growth ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Deposit volume */}
              <Card>
                <CardHeader>
                  <SectionHeader
                    title="Transaction Volume"
                    description="Deposits vs withdrawals (₦ Naira)"
                    badge={range}
                  />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-60 w-full rounded-lg" />
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart
                        data={d?.depositSeries}
                        margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="depositGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#047857"
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="95%"
                              stopColor="#047857"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="withdrawGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#f97316"
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="95%"
                              stopColor="#f97316"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => fmtNaira(v)}
                          width={52}
                        />
                        <Tooltip content={<ChartTooltip naira />} />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="deposits"
                          name="Deposits"
                          stroke="#047857"
                          strokeWidth={2}
                          fill="url(#depositGrad)"
                        />
                        <Area
                          type="monotone"
                          dataKey="withdrawals"
                          name="Withdrawals"
                          stroke="#f97316"
                          strokeWidth={2}
                          fill="url(#withdrawGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* User growth */}
              <Card>
                <CardHeader>
                  <SectionHeader
                    title="User Growth"
                    description="Cumulative registrations over time"
                    badge={range}
                  />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-60 w-full rounded-lg" />
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart
                        data={d?.userGrowthSeries}
                        margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="userGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#3b82f6"
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="95%"
                              stopColor="#3b82f6"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          tickLine={false}
                          axisLine={false}
                          width={40}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="total"
                          name="Total Users"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#userGrad)"
                        />
                        <Bar
                          dataKey="new"
                          name="New"
                          fill="#bfdbfe"
                          radius={[2, 2, 0, 0]}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Tx breakdown + Circles created ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Transaction type breakdown — bar */}
              <Card>
                <CardHeader>
                  <SectionHeader
                    title="Transaction Breakdown"
                    description="Count by type for the selected period"
                    badge={range}
                  />
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-52 w-full rounded-lg" />
                  ) : !d?.transactionBreakdown.length ? (
                    <div className="flex items-center justify-center h-52 text-sm text-muted-foreground">
                      No transactions in this period.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={d.transactionBreakdown.map((t) => ({
                          ...t,
                          label: TYPE_LABELS[t.type] ?? t.type,
                        }))}
                        margin={{ top: 4, right: 4, bottom: 24, left: 0 }}
                        layout="vertical"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          tick={{
                            fontSize: 10,
                            fill: "var(--muted-foreground)",
                          }}
                          tickLine={false}
                          axisLine={false}
                          width={90}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar
                          dataKey="count"
                          name="Count"
                          fill="#047857"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Tx type volume — donut */}
              <Card>
                <CardHeader>
                  <SectionHeader
                    title="Volume by Type"
                    description="₦ Naira volume share per transaction type"
                    badge={range}
                  />
                </CardHeader>
                <CardContent className="flex flex-col items-center">
                  {isLoading ? (
                    <Skeleton className="h-52 w-52 rounded-full" />
                  ) : !d?.transactionBreakdown.length ? (
                    <div className="flex items-center justify-center h-52 text-sm text-muted-foreground">
                      No data.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={d.transactionBreakdown
                            .filter((t) => t.volumeNaira > 0)
                            .map((t) => ({
                              name: TYPE_LABELS[t.type] ?? t.type,
                              value: t.volumeNaira,
                            }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {d.transactionBreakdown.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={PIE_COLORS[idx % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => fmtNaira(Number(v ?? 0))}
                          contentStyle={{
                            fontSize: 11,
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--popover)",
                            color: "var(--popover-foreground)",
                          }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Circles created bar ── */}
            <Card>
              <CardHeader>
                <SectionHeader
                  title="Circles Created Over Time"
                  description="New savings circles per period"
                  badge={range}
                />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-40 w-full rounded-lg" />
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={d?.circleSeries}
                      margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        width={28}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar
                        dataKey="created"
                        name="Circles Created"
                        fill="#8b5cf6"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* ── Retention + Top circles ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Retention gauges */}
              <Card>
                <CardHeader>
                  <SectionHeader
                    title="User Retention Metrics"
                    description="Platform-wide engagement rates (all time)"
                  />
                </CardHeader>
                <CardContent className="pt-4 space-y-5">
                  {isLoading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex justify-between">
                            <Skeleton className="h-3 w-36" />
                            <Skeleton className="h-3 w-10" />
                          </div>
                          <Skeleton className="h-2 w-full rounded-full" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      ))
                    : retentionGauges.map((g) => (
                        <div key={g.label} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {g.label}
                            </span>
                            <span className="font-semibold font-mono">
                              {g.value}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-700",
                                g.color,
                              )}
                              style={{ width: `${g.value}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {g.count.toLocaleString()} of{" "}
                            {d?.retentionStats.totalUsers.toLocaleString()}{" "}
                            users
                          </p>
                        </div>
                      ))}
                </CardContent>
              </Card>

              {/* Top circles */}
              <Card>
                <CardHeader>
                  <SectionHeader
                    title="Top Circles by Trust Score"
                    description="Highest-performing active circles"
                  />
                </CardHeader>
                <CardContent className="pt-1 divide-y divide-border">
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 py-2.5">
                          <Skeleton className="size-7 rounded-md shrink-0" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-32" />
                            <Skeleton className="h-1.5 w-full rounded-full" />
                          </div>
                          <Skeleton className="h-4 w-12" />
                        </div>
                      ))
                    : d?.topCircles.map((c, i) => {
                        const trustColor =
                          c.trustScore >= 80
                            ? "bg-emerald-500"
                            : c.trustScore >= 55
                              ? "bg-amber-400"
                              : "bg-red-500";

                        const trustTextColor =
                          c.trustScore >= 80
                            ? "text-emerald-600 dark:text-emerald-400"
                            : c.trustScore >= 55
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600";

                        return (
                          <div
                            key={c.id}
                            className="flex items-center gap-3 py-2.5"
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
                              #{i + 1}
                            </span>
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-sm font-medium truncate">
                                {c.name}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span>
                                  {c.memberCount}/{c.maxMembers} members
                                </span>
                                <span>·</span>
                                <span>
                                  Cycle {c.currentCycle}/{c.totalCycles}
                                </span>
                              </div>
                              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    trustColor,
                                  )}
                                  style={{ width: `${c.trustScore}%` }}
                                />
                              </div>
                            </div>
                            <span
                              className={cn(
                                "text-xs font-bold font-mono shrink-0",
                                trustTextColor,
                              )}
                            >
                              {c.trustScore}/100
                            </span>
                          </div>
                        );
                      })}

                  {!isLoading && !d?.topCircles.length && (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No active circles found.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
