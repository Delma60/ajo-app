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

/**
 * GET /api/admin/circles
 *
 * Query params:
 *   limit      number  (default: 20, max: 100)
 *   orderBy    "trustScore" | "createdAt" | "memberCount"  (default: "createdAt")
 *   order      "asc" | "desc"  (default: "desc")
 *   status     "active" | "paused" | "completed" | "cancelled"  (optional filter)
 *   search     string  (optional, in-memory filter on name)
 *   cursor     ISO date string  (for pagination, last createdAt value)
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
    const limitParam = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100);
    const orderBy = searchParams.get("orderBy") ?? "createdAt";
    const order = (searchParams.get("order") ?? "desc") as "asc" | "desc";
    const statusFilter = searchParams.get("status");
    const search = searchParams.get("search")?.toLowerCase() ?? "";
    const cursorParam = searchParams.get("cursor");

    // Build Firestore query
    let q = adminDb.collection("circles") as FirebaseFirestore.Query;

    if (statusFilter) {
      q = q.where("status", "==", statusFilter);
    }

    // Firestore can only orderBy fields that exist on all documents.
    // trustScore and createdAt are safe; memberCount is derived so we sort in-memory.
    const firestoreOrderBy =
      orderBy === "trustScore" ? "trustScore" : "createdAt";

    q = q.orderBy(firestoreOrderBy, order);

    if (cursorParam) {
      try {
        const cursorDate = new Date(cursorParam);
        const cursorTs = Timestamp.fromDate(cursorDate);
        q = q.startAfter(cursorTs);
      } catch {
        // Invalid cursor — ignore and start from the beginning
      }
    }

    // Fetch slightly more than requested so we can detect hasMore
    q = q.limit(limitParam + 1);

    const snap = await q.get();
    const hasMore = snap.docs.length > limitParam;
    const docs = snap.docs.slice(0, limitParam);

    let circles = docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: (data.name as string) ?? "",
        description: (data.description as string) ?? "",
        adminId: (data.adminId as string) ?? "",
        memberIds: (data.memberIds as string[]) ?? [],
        maxMembers: (data.maxMembers as number) ?? 0,
        contribution: (data.contribution as number) ?? 0,
        frequency: (data.frequency as string) ?? "monthly",
        payoutOrder: (data.payoutOrder as string) ?? "rotational",
        status: (data.status as string) ?? "active",
        isPrivate: (data.isPrivate as boolean) ?? false,
        currentCycle: (data.currentCycle as number) ?? 1,
        totalCycles: (data.totalCycles as number) ?? 1,
        trustScore: (data.trustScore as number) ?? 100,
        trustScoreBreakdown: data.trustScoreBreakdown ?? null,
        saved: (data.saved as number) ?? 0,
        tags: (data.tags as string[]) ?? [],
        pendingRequestIds: (data.pendingRequestIds as string[]) ?? [],
        inviteCode: (data.inviteCode as string) ?? "",
        // Derived
        goal:
          ((data.contribution as number) ?? 0) *
          ((data.maxMembers as number) ?? 0),
        memberCount: ((data.memberIds as string[]) ?? []).length,
        // Serialized timestamps
        nextDueDate: data.nextDueDate?.toDate?.()?.toISOString() ?? null,
        nextPayoutDate: data.nextPayoutDate?.toDate?.()?.toISOString() ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    // In-memory search filter
    if (search) {
      circles = circles.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.description.toLowerCase().includes(search)
      );
    }

    // In-memory sort by memberCount (Firestore can't sort on a derived field)
    if (orderBy === "memberCount") {
      circles.sort((a, b) =>
        order === "desc"
          ? b.memberCount - a.memberCount
          : a.memberCount - b.memberCount
      );
    }

    // Cursor for next page (use the last document's createdAt)
    const nextCursor =
      hasMore && docs.length > 0
        ? docs[docs.length - 1].data().createdAt?.toDate?.()?.toISOString() ??
          null
        : null;

    return NextResponse.json({
      success: true,
      data: circles,
      meta: {
        total: circles.length,
        hasMore,
        nextCursor,
      },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/admin/circles]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to fetch circles" },
      { status: 500 }
    );
  }
}