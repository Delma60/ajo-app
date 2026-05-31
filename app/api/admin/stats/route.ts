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
    if (!userSnap.exists) return null;
    if (userSnap.data()?.role !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/stats
 *
 * Returns platform-wide aggregate stats for the admin dashboard.
 * Uses getDocs().length instead of count() aggregation for broader
 * compatibility and to avoid composite-index requirements.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoTs = Timestamp.fromDate(sevenDaysAgo);

    // Run all queries in parallel — use getDocs for reliability
    const [
      usersSnap,
      circlesSnap,
      txSnap,
      disputesSnap,
      recentDepositsSnap,
      recentUsersSnap,
    ] = await Promise.all([
      // Total users — simple collection scan with limit for safety
      adminDb.collection("users").select().get(),

      // Active circles
      adminDb
        .collection("circles")
        .where("status", "==", "active")
        .select()
        .get(),

      // Total successful transactions
      adminDb
        .collection("transactions")
        .where("status", "==", "success")
        .select()
        .get(),

      // Open disputes
      adminDb
        .collection("disputes")
        .where("status", "==", "open")
        .select()
        .get(),

      // Recent successful deposits (last 7 days) — fetch full docs for amount sum
      adminDb
        .collection("transactions")
        .where("type", "==", "deposit")
        .where("status", "==", "success")
        .where("createdAt", ">=", sevenDaysAgoTs)
        .get(),

      // New users this week
      adminDb
        .collection("users")
        .where("createdAt", ">=", sevenDaysAgoTs)
        .select()
        .get(),
    ]);

    const weeklyVolume = recentDepositsSnap.docs.reduce(
      (sum, d) => sum + ((d.data().amount as number) ?? 0),
      0
    );

    return NextResponse.json({
      totalUsers: usersSnap.size,
      activeCircles: circlesSnap.size,
      totalTransactions: txSnap.size,
      openDisputes: disputesSnap.size,
      weeklyVolume,
      newUsersThisWeek: recentUsersSnap.size,
    });
  } catch (err) {
    console.error("[GET /api/admin/stats]", err);
    return NextResponse.json(
      {
        totalUsers: 0,
        activeCircles: 0,
        totalTransactions: 0,
        openDisputes: 0,
        weeklyVolume: 0,
        newUsersThisWeek: 0,
      },
      { status: 500 }
    );
  }
}