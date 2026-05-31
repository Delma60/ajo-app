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

function serializeUser(doc: FirebaseFirestore.DocumentSnapshot) {
  const data = doc.data()!;
  return {
    id: doc.id,
    name: (data.name as string) ?? "",
    email: (data.email as string) ?? "",
    phone: (data.phone as string) ?? "",
    avatarUrl: (data.avatarUrl as string) ?? null,
    role: (data.role as string) ?? "user",
    status: (data.status as string) ?? "active",
    onboardingComplete: (data.onboardingComplete as boolean) ?? false,
    circleIds: (data.circleIds as string[]) ?? [],
    referralCode: (data.referralCode as string) ?? "",
    referredBy: (data.referredBy as string) ?? null,
    referralBonusAmount: (data.referralBonusAmount as number) ?? 0,
    bankAccounts: (data.bankAccounts as any[]) ?? [],
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
  };
}

/**
 * GET /api/admin/users
 *
 * Query params:
 *   limit      number   (default: 20, max: 100)
 *   orderBy    "createdAt" | "name" | "email"  (default: "createdAt")
 *   order      "asc" | "desc"  (default: "desc")
 *   status     "active" | "suspended" | "banned"  (optional)
 *   role       "user" | "admin"  (optional)
 *   search     string  (in-memory filter on name/email/phone)
 *   cursor     ISO date string  (keyset pagination on createdAt)
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
    const roleFilter = searchParams.get("role");
    const search = searchParams.get("search")?.toLowerCase().trim() ?? "";
    const cursorParam = searchParams.get("cursor");

    let q = adminDb.collection("users") as FirebaseFirestore.Query;

    if (statusFilter) q = q.where("status", "==", statusFilter);
    if (roleFilter) q = q.where("role", "==", roleFilter);

    // Only Firestore-native fields can be used for orderBy without composite index issues
    const firestoreOrderBy = orderBy === "name" || orderBy === "email" ? orderBy : "createdAt";
    q = q.orderBy(firestoreOrderBy, order);

    if (cursorParam) {
      try {
        if (firestoreOrderBy === "createdAt") {
          q = q.startAfter(Timestamp.fromDate(new Date(cursorParam)));
        } else {
          q = q.startAfter(cursorParam);
        }
      } catch {
        // Invalid cursor, start from beginning
      }
    }

    q = q.limit(limitParam + 1);

    const snap = await q.get();
    const hasMore = snap.docs.length > limitParam;
    const docs = snap.docs.slice(0, limitParam);

    let users = docs.map(serializeUser);

    // In-memory search across name, email, phone
    if (search) {
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          u.phone.toLowerCase().includes(search)
      );
    }

    // Cursor for next page
    const lastDoc = docs[docs.length - 1];
    const nextCursor =
      hasMore && lastDoc
        ? firestoreOrderBy === "createdAt"
          ? lastDoc.data().createdAt?.toDate?.()?.toISOString() ?? null
          : (lastDoc.data()[firestoreOrderBy] as string) ?? null
        : null;

    return NextResponse.json({
      success: true,
      data: users,
      meta: { total: users.length, hasMore, nextCursor },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/admin/users]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[id] is in its own route file.
 * This handler supports bulk status update via body:
 * { ids: string[], action: "suspend" | "ban" | "activate" }
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
    const { ids, action } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: "ids array is required" },
        { status: 400 }
      );
    }

    const validActions = ["suspend", "ban", "activate"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, data: null, error: `action must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    const statusMap: Record<string, string> = {
      suspend: "suspended",
      ban: "banned",
      activate: "active",
    };

    const batch = adminDb.batch();
    for (const uid of ids.slice(0, 500)) {
      batch.update(adminDb.collection("users").doc(uid), {
        status: statusMap[action],
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    return NextResponse.json({
      success: true,
      data: { updated: ids.length, action },
      error: null,
    });
  } catch (err) {
    console.error("[PATCH /api/admin/users]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to update users" },
      { status: 500 }
    );
  }
}