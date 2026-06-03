import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

const SESSION_COOKIE = "__session";

async function getAdminUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

/**
 * GET /api/admin/analytics
 *
 * Query params:
 *   range = "7d" | "30d" | "90d" | "12m"  (default: "30d")
 *
 * Returns:
 *   - depositSeries      Daily/weekly deposit volume
 *   - userGrowthSeries   Cumulative user registrations
 *   - circleSeries       Active circles over time
 *   - transactionBreakdown  Counts by type (last range)
 *   - topCircles         Circles ranked by trust score
 *   - retentionStats     Onboarding completion, active ratio
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") ?? "30d") as "7d" | "30d" | "90d" | "12m";

  const now = new Date();
  let buckets: { label: string; start: Date; end: Date }[] = [];

  if (range === "7d") {
    for (let i = 6; i >= 0; i--) {
      const start = startOfDay(addDays(now, -i));
      const end = addDays(start, 1);
      buckets.push({
        label: start.toLocaleDateString("en-NG", { weekday: "short", day: "numeric" }),
        start,
        end,
      });
    }
  } else if (range === "30d") {
    for (let i = 29; i >= 0; i--) {
      const start = startOfDay(addDays(now, -i));
      const end = addDays(start, 1);
      buckets.push({
        label: start.toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
        start,
        end,
      });
    }
  } else if (range === "90d") {
    // Weekly buckets
    for (let i = 12; i >= 0; i--) {
      const start = startOfDay(addDays(now, -(i * 7)));
      const end = addDays(start, 7);
      buckets.push({
        label: start.toLocaleDateString("en-NG", { day: "numeric", month: "short" }),
        start,
        end,
      });
    }
  } else {
    // 12m → monthly
    for (let i = 11; i >= 0; i--) {
      const start = startOfMonth(addMonths(now, -i));
      const end = startOfMonth(addMonths(now, -i + 1));
      buckets.push({
        label: start.toLocaleDateString("en-NG", { month: "short", year: "2-digit" }),
        start,
        end,
      });
    }
  }

  const rangeStart = buckets[0].start;
  const rangeStartTs = Timestamp.fromDate(rangeStart);

  try {
    // Parallel data fetches
    const [
      depositSnap,
      withdrawalSnap,
      userSnap,
      circleSnap,
      allTxTypesSnap,
      topCirclesSnap,
      allUsersSnap,
    ] = await Promise.all([
      adminDb
        .collection("transactions")
        .where("type", "==", "deposit")
        .where("status", "==", "success")
        .where("createdAt", ">=", rangeStartTs)
        .get(),
      adminDb
        .collection("transactions")
        .where("type", "==", "withdrawal")
        .where("status", "==", "success")
        .where("createdAt", ">=", rangeStartTs)
        .get(),
      adminDb
        .collection("users")
        .where("createdAt", ">=", rangeStartTs)
        .orderBy("createdAt", "asc")
        .get(),
      adminDb
        .collection("circles")
        .where("createdAt", ">=", rangeStartTs)
        .get(),
      adminDb
        .collection("transactions")
        .where("status", "==", "success")
        .where("createdAt", ">=", rangeStartTs)
        .get(),
      adminDb
        .collection("circles")
        .where("status", "==", "active")
        .orderBy("trustScore", "desc")
        .limit(5)
        .get(),
      // For user growth baseline count before range
      adminDb.collection("users").select().get(),
    ]);

    // ── Deposit volume series ──────────────────────────────────────────────
    const depositSeries = buckets.map((b) => {
      const total = depositSnap.docs
        .filter((d) => {
          const ts = d.data().createdAt?.toDate?.() ?? new Date(0);
          return ts >= b.start && ts < b.end;
        })
        .reduce((sum, d) => sum + ((d.data().amount as number) ?? 0), 0);

      const withdrawals = withdrawalSnap.docs
        .filter((d) => {
          const ts = d.data().createdAt?.toDate?.() ?? new Date(0);
          return ts >= b.start && ts < b.end;
        })
        .reduce((sum, d) => sum + ((d.data().amount as number) ?? 0), 0);

      return {
        label: b.label,
        deposits: Math.round(total / 100),   // convert kobo → naira
        withdrawals: Math.round(withdrawals / 100),
        net: Math.round((total - withdrawals) / 100),
      };
    });

    // ── User growth series ─────────────────────────────────────────────────
    // Baseline = total users before rangeStart
    const totalUsersBeforeRange = allUsersSnap.size - userSnap.size;
    let runningCount = totalUsersBeforeRange;

    const userGrowthSeries = buckets.map((b) => {
      const newInBucket = userSnap.docs.filter((d) => {
        const ts = d.data().createdAt?.toDate?.() ?? new Date(0);
        return ts >= b.start && ts < b.end;
      }).length;
      runningCount += newInBucket;
      return { label: b.label, total: runningCount, new: newInBucket };
    });

    // ── Circles created series ─────────────────────────────────────────────
    const circleSeries = buckets.map((b) => {
      const created = circleSnap.docs.filter((d) => {
        const ts = d.data().createdAt?.toDate?.() ?? new Date(0);
        return ts >= b.start && ts < b.end;
      }).length;
      return { label: b.label, created };
    });

    // ── Transaction type breakdown ─────────────────────────────────────────
    // allTxTypesSnap is already filtered by status == "success"
    const typeCounts: Record<string, number> = {};
    const typeVolumes: Record<string, number> = {};
    for (const doc of allTxTypesSnap.docs) {
      const { type, amount } = doc.data() as { type: string; amount: number };
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
      typeVolumes[type] = (typeVolumes[type] ?? 0) + (amount ?? 0);
    }

    const transactionBreakdown = Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
      volumeNaira: Math.round((typeVolumes[type] ?? 0) / 100),
    }));

    // ── Top circles ────────────────────────────────────────────────────────
    const topCircles = topCirclesSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name as string,
        trustScore: data.trustScore as number,
        memberCount: (data.memberIds as string[])?.length ?? 0,
        maxMembers: data.maxMembers as number,
        contribution: data.contribution as number,
        frequency: data.frequency as string,
        currentCycle: data.currentCycle as number,
        totalCycles: data.totalCycles as number,
      };
    });

    // ── Retention stats ────────────────────────────────────────────────────
    const allUsersFullSnap = await adminDb
      .collection("users")
      .select("onboardingComplete", "status", "circleIds")
      .get();

    let onboardingComplete = 0;
    let activeUsers = 0;
    let usersInCircles = 0;
    for (const doc of allUsersFullSnap.docs) {
      const d = doc.data();
      if (d.onboardingComplete) onboardingComplete++;
      if (d.status === "active") activeUsers++;
      if ((d.circleIds as string[])?.length > 0) usersInCircles++;
    }

    const totalUsers = allUsersFullSnap.size;
    const retentionStats = {
      totalUsers,
      onboardingCompletionRate: totalUsers > 0 ? Math.round((onboardingComplete / totalUsers) * 100) : 0,
      activeUserRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
      circleParticipationRate: totalUsers > 0 ? Math.round((usersInCircles / totalUsers) * 100) : 0,
      onboardingComplete,
      activeUsers,
      usersInCircles,
    };

    return NextResponse.json({
      success: true,
      data: {
        range,
        depositSeries,
        userGrowthSeries,
        circleSeries,
        transactionBreakdown,
        topCircles,
        retentionStats,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/analytics]", err);
    return NextResponse.json({ success: false, error: "Failed to fetch analytics" }, { status: 500 });
  }
}