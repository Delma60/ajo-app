import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET() {
  try {
    const [usersSnap, circlesSnap, txSnap, disputesSnap] = await Promise.all([
      adminDb.collection("users").count().get(),
      adminDb.collection("circles").where("status", "==", "active").count().get(),
      adminDb.collection("transactions").where("status", "==", "success").count().get(),
      adminDb.collection("disputes").where("status", "==", "open").count().get(),
    ]);

    // Recent transactions volume (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [recentDepositsSnap, recentUsersSnap] = await Promise.all([
      adminDb
        .collection("transactions")
        .where("type", "==", "deposit")
        .where("status", "==", "success")
        .where("createdAt", ">=", sevenDaysAgo)
        .get(),
      adminDb
        .collection("users")
        .where("createdAt", ">=", sevenDaysAgo)
        .count()
        .get(),
    ]);

    const weeklyVolume = recentDepositsSnap.docs.reduce(
      (sum, d) => sum + ((d.data().amount as number) ?? 0),
      0
    );

    return NextResponse.json({
      totalUsers: usersSnap.data().count,
      activeCircles: circlesSnap.data().count,
      totalTransactions: txSnap.data().count,
      openDisputes: disputesSnap.data().count,
      weeklyVolume,
      newUsersThisWeek: recentUsersSnap.data().count,
    });
  } catch {
    return NextResponse.json({
      totalUsers: 0,
      activeCircles: 0,
      totalTransactions: 0,
      openDisputes: 0,
      weeklyVolume: 0,
      newUsersThisWeek: 0,
    }, { status: 500 });
  }
}
