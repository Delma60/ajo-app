import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

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
 * GET /api/admin/notifications
 *
 * Query params:
 *   limit      number   (default: 30, max: 100)
 *   type       notification type filter (optional)
 *   read       "true" | "false" | "all"  (default: "all")
 *   search     string   (in-memory filter on title, body, userName)
 *   cursor     ISO date string  (keyset pagination on createdAt desc)
 *   userId     string   (filter by specific user, optional)
 *
 * Returns paginated platform-wide notifications enriched with user profiles.
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
    const readFilter = searchParams.get("read") ?? "all";
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";
    const cursorParam = searchParams.get("cursor");
    const userIdFilter = searchParams.get("userId");

    let q = adminDb.collection("notifications") as FirebaseFirestore.Query;

    if (typeFilter) q = q.where("type", "==", typeFilter);
    if (readFilter === "true") q = q.where("read", "==", true);
    if (readFilter === "false") q = q.where("read", "==", false);
    if (userIdFilter) q = q.where("userId", "==", userIdFilter);

    q = q.orderBy("createdAt", "desc").limit(limitParam + 1);

    if (cursorParam) {
      try {
        q = q.startAfter(Timestamp.fromDate(new Date(cursorParam)));
      } catch {
        // Invalid cursor — start from beginning
      }
    }

    const snap = await q.get();
    const hasMore = snap.docs.length > limitParam;
    const docs = snap.docs.slice(0, limitParam);

    // Batch-fetch user profiles for enrichment
    const userIds = [
      ...new Set(docs.map((d) => d.data().userId as string).filter(Boolean)),
    ];
    const userMap = new Map<
      string,
      { name: string; email: string; avatarUrl: string | null }
    >();

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

    let notifications = docs.map((doc) => {
      const d = doc.data();
      const user = userMap.get(d.userId as string);
      return {
        id: doc.id,
        userId: (d.userId as string) ?? "",
        userName: user?.name ?? "Unknown User",
        userEmail: user?.email ?? "",
        userAvatarUrl: user?.avatarUrl ?? null,
        type: (d.type as string) ?? "general",
        title: (d.title as string) ?? "",
        body: (d.body as string) ?? "",
        read: (d.read as boolean) ?? false,
        link: (d.link as string) ?? null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    // In-memory search
    if (search) {
      notifications = notifications.filter(
        (n) =>
          n.title.toLowerCase().includes(search) ||
          n.body.toLowerCase().includes(search) ||
          n.userName.toLowerCase().includes(search) ||
          n.userEmail.toLowerCase().includes(search)
      );
    }

    // Cursor for next page
    const lastDoc = docs[docs.length - 1];
    const nextCursor =
      hasMore && lastDoc
        ? lastDoc.data().createdAt?.toDate?.()?.toISOString() ?? null
        : null;

    // Aggregate stats across all (unfiltered) — lightweight pass over current page
    const allSnap = await adminDb.collection("notifications").get();
    const stats = {
      total: allSnap.size,
      unread: 0,
      read: 0,
      byType: {} as Record<string, number>,
    };
    for (const doc of allSnap.docs) {
      const d = doc.data();
      const t = (d.type as string) ?? "general";
      if (d.read) stats.read++;
      else stats.unread++;
      stats.byType[t] = (stats.byType[t] ?? 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: notifications,
      meta: { hasMore, nextCursor, stats },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/admin/notifications]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/notifications
 * Body: { userId: string, type: string, title: string, body: string, link?: string }
 *
 * Admin can send a manual notification to any user.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const payload = await request.json();
    const { userId, userIds, type, title, body: notifBody, link } = payload;

    const recipients: string[] = Array.isArray(userIds)
      ? userIds
      : typeof userId === "string" && userId.trim()
      ? [userId]
      : [];

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: "userId or userIds are required" },
        { status: 400 }
      );
    }
    if (!title?.trim() || !notifBody?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: "title and body are required" },
        { status: 400 }
      );
    }

    const validTypes = [
      "contribution_due",
      "payout_received",
      "member_joined",
      "circle_invite",
      "penalty_applied",
      "dispute_raised",
      "general",
    ];
    const notifType = validTypes.includes(type) ? type : "general";

    const createdIds: string[] = [];

    // Cap to reasonable limit for manual sends
    const cap = 500;
    const toProcess = recipients.slice(0, cap);

    for (const uid of toProcess) {
      try {
        const userSnap = await adminDb.collection("users").doc(uid).get();
        if (!userSnap.exists) continue;

        const notifRef = adminDb.collection("notifications").doc();
        await notifRef.set({
          id: notifRef.id,
          userId: uid,
          type: notifType,
          title: title.trim(),
          body: notifBody.trim(),
          read: false,
          link: link ?? null,
          sentByAdmin: admin.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
        createdIds.push(notifRef.id);
      } catch (e) {
        // skip failures for individual recipients
        console.error("failed to create notification for", uid, e);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: { created: createdIds.length, ids: createdIds },
        error: null,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/admin/notifications]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to send notification" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/notifications
 * Body: { action: "mark_all_read" | "delete_read" }
 *
 * Bulk operations across all notifications.
 */
export async function PATCH(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "mark_all_read") {
      const unreadSnap = await adminDb
        .collection("notifications")
        .where("read", "==", false)
        .get();

      if (unreadSnap.empty) {
        return NextResponse.json({
          success: true,
          data: { count: 0 },
          error: null,
        });
      }

      // Firestore batch allows max 500 ops — chunk if needed
      const chunks: FirebaseFirestore.QueryDocumentSnapshot[][] = [];
      for (let i = 0; i < unreadSnap.docs.length; i += 499) {
        chunks.push(unreadSnap.docs.slice(i, i + 499));
      }

      for (const chunk of chunks) {
        const batch = adminDb.batch();
        chunk.forEach((doc) => batch.update(doc.ref, { read: true }));
        await batch.commit();
      }

      return NextResponse.json({
        success: true,
        data: { count: unreadSnap.size },
        error: null,
      });
    }

    if (action === "delete_read") {
      const readSnap = await adminDb
        .collection("notifications")
        .where("read", "==", true)
        .get();

      if (readSnap.empty) {
        return NextResponse.json({
          success: true,
          data: { count: 0 },
          error: null,
        });
      }

      const chunks: FirebaseFirestore.QueryDocumentSnapshot[][] = [];
      for (let i = 0; i < readSnap.docs.length; i += 499) {
        chunks.push(readSnap.docs.slice(i, i + 499));
      }

      for (const chunk of chunks) {
        const batch = adminDb.batch();
        chunk.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
      }

      return NextResponse.json({
        success: true,
        data: { count: readSnap.size },
        error: null,
      });
    }

    return NextResponse.json(
      { success: false, data: null, error: "Invalid action" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[PATCH /api/admin/notifications]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to process bulk action" },
      { status: 500 }
    );
  }
}