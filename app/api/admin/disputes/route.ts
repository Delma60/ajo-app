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
 * GET /api/admin/disputes
 *
 * Query params:
 *   limit      number  (default: 30, max: 100)
 *   status     "open" | "under_review" | "resolved" | "dismissed"  (optional)
 *   type       "missed_payout" | "admin_abuse" | "fraudulent_member" | "other"  (optional)
 *   search     string  (in-memory filter on reporter name, circle name, description)
 *   cursor     ISO date string  (keyset pagination on createdAt desc)
 *   dateFrom   ISO date string
 *   dateTo     ISO date string
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
    const typeFilter = searchParams.get("type");
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";
    const cursorParam = searchParams.get("cursor");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    let q = adminDb.collection("disputes") as FirebaseFirestore.Query;

    if (statusFilter) q = q.where("status", "==", statusFilter);
    if (typeFilter) q = q.where("type", "==", typeFilter);

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
        // Invalid cursor — ignore
      }
    }

    const snap = await q.get();
    const hasMore = snap.docs.length > limitParam;
    const docs = snap.docs.slice(0, limitParam);

    // Batch-fetch: reporters, accused users, circles, resolvers
    const reporterIds = [...new Set(docs.map((d) => d.data().raisedBy as string).filter(Boolean))];
    const accusedIds = [...new Set(docs.map((d) => d.data().againstUserId as string).filter(Boolean))];
    const circleIds = [...new Set(docs.map((d) => d.data().circleId as string).filter(Boolean))];
    const resolverIds = [...new Set(docs.map((d) => d.data().resolvedBy as string).filter(Boolean))];

    const allUserIds = [...new Set([...reporterIds, ...accusedIds, ...resolverIds])];

    const [userSnaps, circleSnaps] = await Promise.all([
      allUserIds.length > 0
        ? adminDb.getAll(...allUserIds.map((id) => adminDb.collection("users").doc(id)))
        : Promise.resolve([]),
      circleIds.length > 0
        ? adminDb.getAll(...circleIds.map((id) => adminDb.collection("circles").doc(id)))
        : Promise.resolve([]),
    ]);

    const userMap = new Map<string, { name: string; email: string; avatarUrl: string | null }>();
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

    const circleMap = new Map<string, string>();
    for (const snap of circleSnaps) {
      if (snap.exists) {
        circleMap.set(snap.id, (snap.data()!.name as string) ?? "Unknown Circle");
      }
    }

    let disputes = docs.map((doc) => {
      const d = doc.data();
      const reporter = userMap.get(d.raisedBy as string);
      const accused = d.againstUserId ? userMap.get(d.againstUserId as string) : null;
      const resolver = d.resolvedBy ? userMap.get(d.resolvedBy as string) : null;

      return {
        id: doc.id,
        circleId: (d.circleId as string) ?? "",
        circleName: circleMap.get(d.circleId as string) ?? "Unknown Circle",
        raisedBy: (d.raisedBy as string) ?? "",
        reporterName: reporter?.name ?? "Unknown",
        reporterEmail: reporter?.email ?? "",
        reporterAvatarUrl: reporter?.avatarUrl ?? null,
        againstUserId: (d.againstUserId as string) ?? null,
        againstUserName: accused?.name ?? null,
        againstUserEmail: accused?.email ?? null,
        type: (d.type as string) ?? "other",
        description: (d.description as string) ?? "",
        status: (d.status as string) ?? "open",
        resolution: (d.resolution as string) ?? null,
        resolvedBy: (d.resolvedBy as string) ?? null,
        resolvedByName: resolver?.name ?? null,
        resolvedAt: d.resolvedAt?.toDate?.()?.toISOString() ?? null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    // In-memory search
    if (search) {
      disputes = disputes.filter(
        (d) =>
          d.reporterName.toLowerCase().includes(search) ||
          d.reporterEmail.toLowerCase().includes(search) ||
          d.circleName.toLowerCase().includes(search) ||
          d.description.toLowerCase().includes(search) ||
          (d.againstUserName?.toLowerCase().includes(search) ?? false)
      );
    }

    // Stats across ALL disputes (unfiltered)
    const allSnap = await adminDb.collection("disputes").get();
    const stats = { total: 0, open: 0, under_review: 0, resolved: 0, dismissed: 0 };
    for (const doc of allSnap.docs) {
      const status = doc.data().status as string;
      stats.total++;
      if (status === "open") stats.open++;
      else if (status === "under_review") stats.under_review++;
      else if (status === "resolved") stats.resolved++;
      else if (status === "dismissed") stats.dismissed++;
    }

    const lastDoc = docs[docs.length - 1];
    const nextCursor =
      hasMore && lastDoc
        ? lastDoc.data().createdAt?.toDate?.()?.toISOString() ?? null
        : null;

    return NextResponse.json({
      success: true,
      data: disputes,
      meta: { hasMore, nextCursor, stats },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/admin/disputes]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to fetch disputes" },
      { status: 500 }
    );
  }
}