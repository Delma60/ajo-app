import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { creditWallet } from "@/lib/services/wallet-service";
import { sendNotification } from "@/lib/services/notification-service";
import { INVESTMENT_PACKAGES } from "@/lib/types/investment";

const SESSION_COOKIE = "__session";
const PLATFORM_FEE_PERCENT = 0.01;

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
 * GET /api/admin/investments/[id]
 *
 * Returns full investment detail enriched with user profile and wallet snapshot.
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

    const invSnap = await adminDb.collection("investments").doc(id).get();
    if (!invSnap.exists) {
      return NextResponse.json(
        { success: false, data: null, error: "Investment not found" },
        { status: 404 }
      );
    }

    const d = invSnap.data()!;
    const userId = d.userId as string;

    const [userSnap, walletSnap] = await Promise.all([
      adminDb.collection("users").doc(userId).get(),
      adminDb.collection("wallets").doc(userId).get(),
    ]);

    const user = userSnap.data();
    const wallet = walletSnap.data();

    const now = Date.now();
    const startDateMs = d.startDate?.toMillis?.() ?? now;
    const maturityDateMs = d.maturityDate?.toMillis?.() ?? now;
    const totalMs = maturityDateMs - startDateMs;
    const elapsed = Math.min(now - startDateMs, totalMs);
    const progressPercent =
      totalMs > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / totalMs) * 100))) : 0;
    const daysRemaining = Math.max(0, Math.ceil((maturityDateMs - now) / 86_400_000));
    const isMatured = now >= maturityDateMs;
    const principalKobo = (d.principalKobo as number) ?? 0;
    const interestKobo = (d.interestKobo as number) ?? 0;
    const accruedValueKobo =
      totalMs > 0
        ? Math.round(principalKobo + (interestKobo * elapsed) / totalMs)
        : principalKobo;

    const pkg = INVESTMENT_PACKAGES.find((p) => p.id === d.packageId);
    const platformFeeKobo = Math.round(interestKobo * PLATFORM_FEE_PERCENT);
    const netReturnKobo = (d.expectedReturnKobo as number) - platformFeeKobo;

    return NextResponse.json({
      success: true,
      data: {
        id: invSnap.id,
        userId,
        userName: (user?.name as string) ?? "Unknown",
        userEmail: (user?.email as string) ?? "",
        userPhone: (user?.phone as string) ?? "",
        userAvatarUrl: (user?.avatarUrl as string) ?? null,
        walletBalance: (wallet?.available as number) ?? 0,
        packageId: (d.packageId as string) ?? "",
        packageName: (d.packageName as string) ?? "",
        packageCategory: pkg?.category ?? "treasury-bills",
        principalKobo,
        annualYieldPercent: (d.annualYieldPercent as number) ?? 0,
        durationDays: (d.durationDays as number) ?? 0,
        expectedReturnKobo: (d.expectedReturnKobo as number) ?? 0,
        interestKobo,
        platformFeeKobo,
        netReturnKobo,
        status: (d.status as string) ?? "active",
        riskLevel: (d.riskLevel as string) ?? "low",
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
      },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/admin/investments/[id]]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to fetch investment detail" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/investments/[id]
 * Body: { action: "force_withdraw" | "cancel" }
 *
 * force_withdraw — Admin-initiated early payout regardless of maturity.
 *   Useful for resolving disputes or user hardship.
 *   Credits the accrued value (not full expected return) minus platform fee.
 *   Adds an admin note to the investment document.
 *
 * cancel — Marks investment cancelled and refunds principal only.
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
    const body = await request.json();
    const { action, adminNote } = body;

    if (!["force_withdraw", "cancel"].includes(action)) {
      return NextResponse.json(
        { success: false, data: null, error: "action must be 'force_withdraw' or 'cancel'" },
        { status: 400 }
      );
    }

    const invRef = adminDb.collection("investments").doc(id);
    const invSnap = await invRef.get();
    if (!invSnap.exists) {
      return NextResponse.json(
        { success: false, data: null, error: "Investment not found" },
        { status: 404 }
      );
    }

    const d = invSnap.data()!;
    if (d.status !== "active") {
      return NextResponse.json(
        { success: false, data: null, error: `Cannot act on investment with status "${d.status}"` },
        { status: 400 }
      );
    }

    const userId = d.userId as string;
    const principalKobo = (d.principalKobo as number) ?? 0;
    const interestKobo = (d.interestKobo as number) ?? 0;
    const expectedReturnKobo = (d.expectedReturnKobo as number) ?? 0;

    if (action === "force_withdraw") {
      const now = Date.now();
      const startDateMs = d.startDate?.toMillis?.() ?? now;
      const maturityDateMs = d.maturityDate?.toMillis?.() ?? now;
      const totalMs = maturityDateMs - startDateMs;
      const elapsed = Math.min(now - startDateMs, totalMs);

      // Accrued interest up to now (pro-rated)
      const accruedInterest =
        totalMs > 0 ? Math.round((interestKobo * elapsed) / totalMs) : 0;
      const accruedTotal = principalKobo + accruedInterest;
      const platformFeeKobo = Math.round(accruedInterest * PLATFORM_FEE_PERCENT);
      const netPayout = accruedTotal - platformFeeKobo;

      await adminDb.runTransaction(async (tx) => {
        await creditWallet(
          tx,
          userId,
          netPayout,
          "payout",
          `Admin-initiated early payout: ${d.packageName as string}`,
          {}
        );
        tx.update(invRef, {
          status: "withdrawn",
          withdrawnAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          adminAction: {
            type: "force_withdraw",
            adminId: admin.uid,
            note: adminNote ?? "",
            netPayout,
            platformFeeKobo,
            executedAt: FieldValue.serverTimestamp(),
          },
        });
      });

      void sendNotification(userId, {
        type: "payout_received",
        title: "Investment Payout Processed",
        body: `Your ${d.packageName as string} investment has been paid out early by admin. ₦${(netPayout / 100).toLocaleString("en-NG")} credited to your wallet.`,
        link: "/investments",
      });

      return NextResponse.json({
        success: true,
        data: { action: "force_withdraw", netPayout, platformFeeKobo },
        error: null,
      });
    }

    // action === "cancel" — refund principal only
    await adminDb.runTransaction(async (tx) => {
      await creditWallet(
        tx,
        userId,
        principalKobo,
        "payout",
        `Admin-initiated cancellation refund: ${d.packageName as string}`,
        {}
      );
      tx.update(invRef, {
        status: "cancelled",
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        adminAction: {
          type: "cancel",
          adminId: admin.uid,
          note: adminNote ?? "",
          refundKobo: principalKobo,
          executedAt: FieldValue.serverTimestamp(),
        },
      });
    });

    void sendNotification(userId, {
      type: "general",
      title: "Investment Cancelled",
      body: `Your ${d.packageName as string} investment was cancelled by admin. Your principal of ₦${(principalKobo / 100).toLocaleString("en-NG")} has been refunded.`,
      link: "/investments",
    });

    return NextResponse.json({
      success: true,
      data: { action: "cancel", refundKobo: principalKobo },
      error: null,
    });
  } catch (err) {
    console.error("[PATCH /api/admin/investments/[id]]", err);
    return NextResponse.json(
      { success: false, data: null, error: "Failed to process investment action" },
      { status: 500 }
    );
  }
}