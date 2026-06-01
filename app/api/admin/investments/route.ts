import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { getInvestmentSettings } from "@/lib/services/settings-service";
import { INVESTMENT_PACKAGES } from "@/lib/types/investment";

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

function deriveProgress(
  startDateMs: number,
  maturityDateMs: number
): { progressPercent: number; daysRemaining: number; isMatured: boolean; accruedValueKobo: number; principalKobo: number; interestKobo: number } {
  const now = Date.now();
  const totalMs = maturityDateMs - startDateMs;
  const elapsed = Math.min(now - startDateMs, totalMs);
  const progressPercent = Math.max(0, Math.min(100, Math.round((elapsed / totalMs) * 100)));
  const daysRemaining = Math.max(0, Math.ceil((maturityDateMs - now) / 86_400_000));
  const isMatured = now >= maturityDateMs;
  return { progressPercent, daysRemaining, isMatured, accruedValueKobo: 0, principalKobo: 0, interestKobo: 0 };
}

/**
 * GET /api/admin/investments
 *
 * Query params:
 *   limit       number   (default: 30, max: 100)
 *   status      "active" | "matured" | "withdrawn" | "cancelled"  (optional)
 *   category    "treasury-bills" | "money-market" | "fixed-deposit" | "mutual-fund"  (optional)
 *   riskLevel   "low" | "medium" | "high"  (optional)
 *   search      string   (matches userName, userEmail; in-memory)
 *   cursor      ISO date string  (keyset pagination on createdAt desc)
 *   dateFrom    ISO date string  (lower bound on createdAt)
 *   dateTo      ISO date string  (upper bound on createdAt)
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Math.min(parseInt(searchParams.get("limit") ?? "30"), 100);
    const statusFilter = searchParams.get("status");
    const categoryFilter = searchParams.get("category");
    const riskFilter = searchParams.get("riskLevel");
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";
    const cursorParam = searchParams.get("cursor");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    let q = adminDb.collection("investments") as FirebaseFirestore.Query;

    if (statusFilter) q = q.where("status", "==", statusFilter);
    if (riskFilter) q = q.where("riskLevel", "==", riskFilter);

    if (dateFrom) {
      q = q.where("createdAt", ">=", Timestamp.fromDate(new Date(dateFrom)));
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      q = q.where("createdAt", "<=", Timestamp.fromDate(to));
    }

    q = q.orderBy("createdAt", "desc").limit(limitParam + 1);

    if (cursorParam) {
      try {
        q = q.startAfter(Timestamp.fromDate(new Date(cursorParam)));
      } catch {
        // ignore invalid cursor
      }
    }

    const snap = await q.get();
    const hasMore = snap.docs.length > limitParam;
    const docs = snap.docs.slice(0, limitParam);

    // Batch-fetch user profiles
    const userIds = [...new Set(docs.map((d) => d.data().userId as string).filter(Boolean))];
    const userMap = new Map<string, { name: string; email: string; avatarUrl: string | null }>();
    if (userIds.length > 0) {
      const userSnaps = await adminDb.getAll(
        ...userIds.map((uid) => adminDb.collection("users").doc(uid))
      );
      for (const snap of userSnaps) {
        if (snap.exists) {
          const d = snap.data()!;
          userMap.set(snap.id, {
            name: (d.name as string) ?? "",
            email: (d.email as string) ?? "",
            avatarUrl: (d.avatarUrl as string) ?? null,
          });
        }
      }
    }

    const now = Date.now();

    let investments = docs
      .map((doc) => {
        const d = doc.data();
        const user = userMap.get(d.userId as string);
        const startDateMs = d.startDate?.toMillis?.() ?? now;
        const maturityDateMs = d.maturityDate?.toMillis?.() ?? now;
        const totalMs = maturityDateMs - startDateMs;
        const elapsed = Math.min(now - startDateMs, totalMs);
        const progressPercent =
          totalMs > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / totalMs) * 100))) : 0;
        const daysRemaining = Math.max(
          0,
          Math.ceil((maturityDateMs - now) / 86_400_000)
        );
        const isMatured = now >= maturityDateMs;
        const principalKobo = (d.principalKobo as number) ?? 0;
        const interestKobo = (d.interestKobo as number) ?? 0;
        const accruedValueKobo =
          totalMs > 0
            ? Math.round(principalKobo + (interestKobo * elapsed) / totalMs)
            : principalKobo;

        // Resolve category from packageId
        const pkg = INVESTMENT_PACKAGES.find((p) => p.id === d.packageId);

        return {
          id: doc.id,
          userId: (d.userId as string) ?? "",
          userName: user?.name ?? "Unknown",
          userEmail: user?.email ?? "",
          userAvatarUrl: user?.avatarUrl ?? null,
          packageId: (d.packageId as string) ?? "",
          packageName: (d.packageName as string) ?? "",
          packageCategory: (pkg?.category ?? "treasury-bills") as AdminInvestment["packageCategory"],
          principalKobo,
          annualYieldPercent: (d.annualYieldPercent as number) ?? 0,
          durationDays: (d.durationDays as number) ?? 0,
          expectedReturnKobo: (d.expectedReturnKobo as number) ?? 0,
          interestKobo,
          status: (d.status as AdminInvestment["status"]) ?? "active",
          riskLevel: (d.riskLevel as AdminInvestment["riskLevel"]) ?? "low",
          startDate: d.startDate?.toDate?.()?.toISOString() ?? null,
          maturityDate: d.maturityDate?.toDate?.()?.toISOString() ?? null,
          withdrawnAt: d.withdrawnAt?.toDate?.()?.toISOString() ?? null,
          cancelledAt: d.cancelledAt?.toDate?.()?.toISOString() ?? null,
          transactionId: (d.transactionId as string) ?? "",
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
          updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? null,
          progressPercent,
          daysRemaining,
          accruedValueKobo,
          isMatured,
        } as AdminInvestment;
      })
      // Client-side category filter (avoids composite index requirement)
      .filter((inv) => !categoryFilter || inv.packageCategory === categoryFilter);

    // In-memory search
    if (search) {
      investments = investments.filter(
        (inv) =>
          inv.userName.toLowerCase().includes(search) ||
          inv.userEmail.toLowerCase().includes(search) ||
          inv.packageName.toLowerCase().includes(search)
      );
    }

    // Cursor for next page
    const lastDoc = docs[docs.length - 1];
    const nextCursor =
      hasMore && lastDoc
        ? lastDoc.data().createdAt?.toDate?.()?.toISOString() ?? null
        : null;

    // Aggregate stats across ALL investments (unfiltered for accuracy)
    const allSnap = await adminDb.collection("investments").get();
    const investmentSettings = await getInvestmentSettings();
    const platformFeePercent = investmentSettings.platformInterestFeePercent / 100;
    
    let totalActiveKobo = 0;
    let totalExpectedReturnKobo = 0;
    let totalWithdrawnKobo = 0;
    let activeCount = 0;
    let maturedCount = 0;
    let withdrawnCount = 0;
    let cancelledCount = 0;
    let platformFeesKobo = 0;

    for (const doc of allSnap.docs) {
      const d = doc.data();
      const status = d.status as string;
      const principal = (d.principalKobo as number) ?? 0;
      const expected = (d.expectedReturnKobo as number) ?? 0;
      const interest = (d.interestKobo as number) ?? 0;
      if (status === "active") { activeCount++; totalActiveKobo += principal; totalExpectedReturnKobo += expected; }
      else if (status === "matured") maturedCount++;
      else if (status === "withdrawn") {
        withdrawnCount++;
        totalWithdrawnKobo += expected;
        platformFeesKobo += Math.round(interest * platformFeePercent);
      } else if (status === "cancelled") cancelledCount++;
    }

    const stats: AdminInvestmentStats = {
      totalActiveKobo,
      totalExpectedReturnKobo,
      totalWithdrawnKobo,
      activeCount,
      maturedCount,
      withdrawnCount,
      cancelledCount,
      platformFeesKobo,
    };

    return NextResponse.json({
      success: true,
      data: investments,
      meta: { hasMore, nextCursor, stats },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/admin/investments]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to fetch investments" },
      { status: 500 }
    );
  }
}

// Re-export type for usage in route
type AdminInvestment = import("@/lib/types/admin-investment").AdminInvestment;
type AdminInvestmentStats = import("@/lib/types/admin-investment").AdminInvestmentStats;