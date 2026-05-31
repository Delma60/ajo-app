import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

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
 * GET /api/admin/transactions
 *
 * Query params:
 *   limit       number   (default: 30, max: 100)
 *   type        "deposit" | "withdrawal" | "contribution" | "payout" |
 *               "penalty" | "referral_bonus" | "creation_fee"  (optional)
 *   status      "pending" | "success" | "failed" | "cancelled"  (optional)
 *   direction   "credit" | "debit"  (optional)
 *   search      string   (matches userId, reference, description; in-memory)
 *   cursor      ISO date string  (keyset pagination on createdAt desc)
 *   dateFrom    ISO date string  (lower bound on createdAt)
 *   dateTo      ISO date string  (upper bound on createdAt)
 *
 * Returns paginated transactions enriched with user name + email.
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
    const typeFilter = searchParams.get("type");
    const statusFilter = searchParams.get("status");
    const directionFilter = searchParams.get("direction");
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";
    const cursorParam = searchParams.get("cursor");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Build Firestore query
    let q = adminDb.collection("transactions") as FirebaseFirestore.Query;

    if (typeFilter) q = q.where("type", "==", typeFilter);
    if (statusFilter) q = q.where("status", "==", statusFilter);
    if (directionFilter) q = q.where("direction", "==", directionFilter);

    if (dateFrom) {
      q = q.where("createdAt", ">=", Timestamp.fromDate(new Date(dateFrom)));
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      q = q.where("createdAt", "<=", Timestamp.fromDate(to));
    }

    q = q.orderBy("createdAt", "desc");

    if (cursorParam) {
      try {
        q = q.startAfter(Timestamp.fromDate(new Date(cursorParam)));
      } catch {
        // Invalid cursor — start from beginning
      }
    }

    q = q.limit(limitParam + 1);

    const snap = await q.get();
    const hasMore = snap.docs.length > limitParam;
    const docs = snap.docs.slice(0, limitParam);

    // Collect unique userIds for batch enrichment
    const userIds = [...new Set(docs.map((d) => d.data().userId as string).filter(Boolean))];

    let userMap = new Map<string, { name: string; email: string; avatarUrl: string | null }>();
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

    let transactions = docs.map((doc) => {
      const d = doc.data();
      const user = userMap.get(d.userId as string);
      return {
        id: doc.id,
        userId: (d.userId as string) ?? "",
        userName: user?.name ?? "Unknown",
        userEmail: user?.email ?? "",
        userAvatarUrl: user?.avatarUrl ?? null,
        circleId: (d.circleId as string) ?? null,
        type: (d.type as string) ?? "",
        direction: (d.direction as "credit" | "debit") ?? "credit",
        amount: (d.amount as number) ?? 0,
        fee: (d.fee as number) ?? 0,
        netAmount: (d.netAmount as number) ?? 0,
        status: (d.status as string) ?? "pending",
        provider: (d.provider as string) ?? null,
        providerReference: (d.providerReference as string) ?? null,
        reference: (d.reference as string) ?? "",
        description: (d.description as string) ?? "",
        meta: (d.meta as Record<string, unknown>) ?? null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    // In-memory search
    if (search) {
      transactions = transactions.filter(
        (t) =>
          t.reference.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search) ||
          t.userName.toLowerCase().includes(search) ||
          t.userEmail.toLowerCase().includes(search) ||
          (t.providerReference ?? "").toLowerCase().includes(search)
      );
    }

    // Cursor for next page
    const lastDoc = docs[docs.length - 1];
    const nextCursor =
      hasMore && lastDoc
        ? lastDoc.data().createdAt?.toDate?.()?.toISOString() ?? null
        : null;

    // Aggregate stats for this filtered view
    const stats = {
      totalVolume: transactions.reduce((s, t) => s + t.amount, 0),
      totalCount: transactions.length,
      successCount: transactions.filter((t) => t.status === "success").length,
      pendingCount: transactions.filter((t) => t.status === "pending").length,
      failedCount: transactions.filter((t) => t.status === "failed").length,
      creditVolume: transactions
        .filter((t) => t.direction === "credit" && t.status === "success")
        .reduce((s, t) => s + t.amount, 0),
      debitVolume: transactions
        .filter((t) => t.direction === "debit" && t.status === "success")
        .reduce((s, t) => s + t.amount, 0),
    };

    return NextResponse.json({
      success: true,
      data: transactions,
      meta: { hasMore, nextCursor, stats },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/admin/transactions]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}