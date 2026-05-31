import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

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

/**
 * GET /api/admin/circles/[id]
 *
 * Returns full circle detail enriched with:
 *  - Admin name + email
 *  - Member list with names, emails, payout indicator
 *  - Recent contributions (last 20) with member names
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;

    const circleSnap = await adminDb.collection("circles").doc(id).get();
    if (!circleSnap.exists) {
      return NextResponse.json(
        { success: false, data: null, error: "Circle not found" },
        { status: 404 }
      );
    }

    const data = circleSnap.data()!;
    const memberIds: string[] = (data.memberIds as string[]) ?? [];

    // Fetch members, contributions, and admin in parallel
    const [memberSnaps, contribSnap] = await Promise.all([
      memberIds.length > 0
        ? adminDb.getAll(
            ...memberIds.map((uid) => adminDb.collection("users").doc(uid))
          )
        : Promise.resolve([]),
      adminDb
        .collection("contributions")
        .where("circleId", "==", id)
        .orderBy("createdAt", "desc")
        .limit(20)
        .get(),
    ]);

    // Build member lookup map
    const memberMap = new Map<string, { name: string; email: string; avatarUrl: string | null }>();
    for (const snap of memberSnaps) {
      if (snap.exists) {
        const d = snap.data()!;
        memberMap.set(snap.id, {
          name: (d.name as string) ?? "",
          email: (d.email as string) ?? "",
          avatarUrl: (d.avatarUrl as string) ?? null,
        });
      }
    }

    // Admin info
    const adminInfo = memberMap.get(data.adminId as string) ?? {
      name: "Unknown",
      email: "",
      avatarUrl: null,
    };

    // Build member list preserving order
    const members = memberIds.map((uid) => {
      const info = memberMap.get(uid) ?? { name: "Unknown", email: "", avatarUrl: null };
      return {
        id: uid,
        name: info.name,
        email: info.email,
        avatarUrl: info.avatarUrl,
        isAdmin: uid === data.adminId,
        isPendingPayout: uid === data.currentRecipientId,
      };
    });

    // Build contributions with member names
    const recentContributions = contribSnap.docs.map((doc) => {
      const c = doc.data();
      const member = memberMap.get(c.userId as string);
      return {
        id: doc.id,
        userId: (c.userId as string) ?? "",
        userName: member?.name ?? "Unknown",
        cycle: (c.cycle as number) ?? 0,
        amount: (c.amount as number) ?? 0,
        status: (c.status as "pending" | "paid" | "late" | "missed") ?? "pending",
        dueDate: c.dueDate?.toDate?.()?.toISOString() ?? null,
        paidAt: c.paidAt?.toDate?.()?.toISOString() ?? null,
        penaltyAmount: (c.penaltyAmount as number) ?? null,
      };
    });

    const memberCount = memberIds.length;
    const maxMembers = (data.maxMembers as number) ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        id: circleSnap.id,
        name: (data.name as string) ?? "",
        description: (data.description as string) ?? "",
        adminId: (data.adminId as string) ?? "",
        adminName: adminInfo.name,
        adminEmail: adminInfo.email,
        memberIds,
        memberCount,
        maxMembers,
        fillPercent: maxMembers > 0 ? Math.round((memberCount / maxMembers) * 100) : 0,
        contribution: (data.contribution as number) ?? 0,
        goal: ((data.contribution as number) ?? 0) * maxMembers,
        frequency: (data.frequency as string) ?? "monthly",
        payoutOrder: (data.payoutOrder as string) ?? "rotational",
        status: (data.status as string) ?? "active",
        isPrivate: (data.isPrivate as boolean) ?? false,
        currentCycle: (data.currentCycle as number) ?? 1,
        totalCycles: (data.totalCycles as number) ?? 1,
        trustScore: (data.trustScore as number) ?? 100,
        trustScoreBreakdown: data.trustScoreBreakdown
          ? {
              onTimePayments: data.trustScoreBreakdown.onTimePayments ?? 0,
              latePayments: data.trustScoreBreakdown.latePayments ?? 0,
              missedPayments: data.trustScoreBreakdown.missedPayments ?? 0,
              lastUpdated: data.trustScoreBreakdown.lastUpdated?.toDate?.()?.toISOString() ?? null,
            }
          : null,
        saved: (data.saved as number) ?? 0,
        tags: (data.tags as string[]) ?? [],
        pendingRequestIds: (data.pendingRequestIds as string[]) ?? [],
        inviteCode: (data.inviteCode as string) ?? "",
        nextDueDate: data.nextDueDate?.toDate?.()?.toISOString() ?? null,
        nextPayoutDate: data.nextPayoutDate?.toDate?.()?.toISOString() ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
        members,
        recentContributions,
      },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/admin/circles/[id]]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to fetch circle details" },
      { status: 500 }
    );
  }
}