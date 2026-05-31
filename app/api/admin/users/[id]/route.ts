import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

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
 * GET /api/admin/users/[id]
 * Returns the full user profile including wallet balance and recent transactions.
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

    const [userSnap, walletSnap, txSnap, circleSnap] = await Promise.all([
      adminDb.collection("users").doc(id).get(),
      adminDb.collection("wallets").doc(id).get(),
      adminDb
        .collection("transactions")
        .where("userId", "==", id)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get(),
      adminDb
        .collection("circles")
        .where("memberIds", "array-contains", id)
        .where("status", "==", "active")
        .limit(10)
        .get(),
    ]);

    if (!userSnap.exists) {
      return NextResponse.json(
        { success: false, data: null, error: "User not found" },
        { status: 404 }
      );
    }

    const userData = userSnap.data()!;
    const walletData = walletSnap.exists ? walletSnap.data()! : null;

    const transactions = txSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        type: d.type,
        direction: d.direction,
        amount: d.amount,
        status: d.status,
        description: d.description,
        reference: d.reference,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    const circles = circleSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        status: d.status,
        contribution: d.contribution,
        frequency: d.frequency,
        memberCount: (d.memberIds as string[])?.length ?? 0,
        maxMembers: d.maxMembers,
        trustScore: d.trustScore,
        isAdmin: d.adminId === id,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        id: userSnap.id,
        name: (userData.name as string) ?? "",
        email: (userData.email as string) ?? "",
        phone: (userData.phone as string) ?? "",
        avatarUrl: (userData.avatarUrl as string) ?? null,
        role: (userData.role as string) ?? "user",
        status: (userData.status as string) ?? "active",
        onboardingComplete: (userData.onboardingComplete as boolean) ?? false,
        circleIds: (userData.circleIds as string[]) ?? [],
        referralCode: (userData.referralCode as string) ?? "",
        referredBy: (userData.referredBy as string) ?? null,
        referralBonusAmount: (userData.referralBonusAmount as number) ?? 0,
        bankAccounts: (userData.bankAccounts as any[]) ?? [],
        createdAt: userData.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: userData.updatedAt?.toDate?.()?.toISOString() ?? null,
        // Enriched
        wallet: walletData
          ? {
              available: walletData.available ?? 0,
              pending: walletData.pending ?? 0,
              totalSaved: walletData.totalSaved ?? 0,
              totalReceived: walletData.totalReceived ?? 0,
              referralEarnings: walletData.referralEarnings ?? 0,
            }
          : null,
        recentTransactions: transactions,
        activeCircles: circles,
      },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/admin/users/[id]]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Body: { action: "suspend" | "ban" | "activate" | "promote" | "demote" }
 * - suspend → status: "suspended"
 * - ban     → status: "banned"
 * - activate → status: "active"
 * - promote → role: "admin"
 * - demote  → role: "user"
 */
export async function PATCH(
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

    // Prevent admin from modifying themselves
    if (id === admin.uid) {
      return NextResponse.json(
        { success: false, data: null, error: "You cannot modify your own account here." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action } = body;

    const validActions = ["suspend", "ban", "activate", "promote", "demote"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, data: null, error: `action must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection("users").doc(id);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json(
        { success: false, data: null, error: "User not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    switch (action) {
      case "suspend":
        updates.status = "suspended";
        break;
      case "ban":
        updates.status = "banned";
        break;
      case "activate":
        updates.status = "active";
        break;
      case "promote":
        updates.role = "admin";
        break;
      case "demote":
        updates.role = "user";
        break;
    }

    await userRef.update(updates);

    // If banning, also revoke Firebase Auth sessions
    if (action === "ban") {
      try {
        await adminAuth.revokeRefreshTokens(id);
      } catch {
        // Non-fatal — user doc is already updated
      }
    }

    return NextResponse.json({
      success: true,
      data: { id, action, ...updates },
      error: null,
    });
  } catch (err) {
    console.error("[PATCH /api/admin/users/[id]]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to update user" },
      { status: 500 }
    );
  }
}