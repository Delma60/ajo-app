import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { creditWallet } from "@/lib/services/wallet-service";
import { sendNotification } from "@/lib/services/notification-service";
import type { Transaction } from "@/lib/types/transaction";

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
 * PATCH /api/admin/transactions/[id]
 * Body: { status: "pending" | "success" | "failed" | "cancelled" }
 *
 * Wallet side-effects:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. REFUND (wallet credit):
 *    - A "success" DEBIT (withdrawal/contribution/penalty/creation_fee) is moved
 *      to "failed" or "cancelled" → refund the full amount back to user's wallet.
 *
 * 2. MANUAL CREDIT (wallet credit):
 *    - A "failed" or "pending" CREDIT (deposit) is moved to "success" →
 *      credit the amount to the user's wallet (manual recovery flow).
 *
 * 3. REVERSE CREDIT (wallet debit) — NOT implemented intentionally.
 *    Admin revoking a previously credited deposit is a destructive/complex
 *    operation that requires manual review; it is not supported here to
 *    prevent accidental negative balances.
 *
 * All wallet mutations run inside a Firestore transaction for atomicity.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing transaction id" }, { status: 400 });
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const VALID_STATUSES = ["pending", "success", "failed", "cancelled"];
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { success: false, error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const newStatus = body.status as Transaction["status"];

  try {
    const txRef = adminDb.collection("transactions").doc(id);
    const txSnap = await txRef.get();

    if (!txSnap.exists) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
    }

    const tx = txSnap.data() as Transaction;
    const oldStatus = tx.status;

    // No-op: status unchanged
    if (oldStatus === newStatus) {
      return NextResponse.json({
        success: true,
        data: { id, status: newStatus, walletAffected: false },
      });
    }

    let walletAffected = false;
    let walletAction: "refund" | "credit" | null = null;

    // ── Determine wallet side-effect ─────────────────────────────────────────

    // CASE 1: Refund — a previously successful DEBIT is being reversed
    const isSuccessfulDebit =
      oldStatus === "success" && tx.direction === "debit";
    const isBeingReversed =
      newStatus === "failed" || newStatus === "cancelled";

    if (isSuccessfulDebit && isBeingReversed) {
      walletAction = "refund";
    }

    // CASE 2: Manual credit — a failed/pending CREDIT (deposit) is recovered
    const isFailedOrPendingCredit =
      (oldStatus === "failed" || oldStatus === "pending") &&
      tx.direction === "credit" &&
      tx.type === "deposit";
    const isBeingMarkedSuccess = newStatus === "success";

    if (isFailedOrPendingCredit && isBeingMarkedSuccess) {
      walletAction = "credit";
    }

    // ── Execute with wallet mutation if needed ────────────────────────────────

    if (walletAction) {
      await adminDb.runTransaction(async (firestoreTx) => {
        // Re-read inside transaction for consistency
        const freshSnap = await firestoreTx.get(txRef);
        const freshTx = freshSnap.data() as Transaction;

        // Guard: abort if status already changed since we last read
        if (freshTx.status !== oldStatus) {
          throw new Error(
            `Transaction status changed concurrently (now "${freshTx.status}"). Please retry.`
          );
        }

        if (walletAction === "refund") {
          // Credit wallet with the full debit amount (refund)
          await creditWallet(
            firestoreTx,
            freshTx.userId,
            freshTx.amount,
            freshTx.type === "withdrawal" ? "withdrawal" : freshTx.type,
            `Admin refund: ${freshTx.description ?? freshTx.type} (ref: ${freshTx.reference})`,
            {
              circleId: freshTx.circleId,
              reference: `REFUND-${freshTx.reference}`,
            }
          );
        } else if (walletAction === "credit") {
          // Manually credit a deposit that was stuck in failed/pending
          await creditWallet(
            firestoreTx,
            freshTx.userId,
            freshTx.amount,
            "deposit",
            `Admin manual credit: ${freshTx.description ?? "deposit"} (ref: ${freshTx.reference})`,
            {
              reference: `MANUAL-${freshTx.reference}`,
            }
          );
        }

        // Update the original transaction status
        firestoreTx.update(txRef, {
          status: newStatus,
          updatedAt: FieldValue.serverTimestamp(),
          adminUpdatedBy: admin.uid,
          adminUpdatedAt: FieldValue.serverTimestamp(),
        });
      });

      walletAffected = true;

      // Notify user outside transaction (fire-and-forget)
      void notifyUser(tx, newStatus, walletAction);
    } else {
      // No wallet impact — simple status update
      await txRef.update({
        status: newStatus,
        updatedAt: FieldValue.serverTimestamp(),
        adminUpdatedBy: admin.uid,
        adminUpdatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        previousStatus: oldStatus,
        status: newStatus,
        walletAffected,
        walletAction,
      },
    });
  } catch (err: any) {
    console.error("[PATCH /api/admin/transactions/[id]]", err);
    return NextResponse.json(
      { success: false, error: err?.message ?? "Update failed" },
      { status: 500 }
    );
  }
}

// ─── Helper: user notification ─────────────────────────────────────────────

async function notifyUser(
  tx: Transaction,
  newStatus: string,
  walletAction: "refund" | "credit" | null
) {
  try {
    if (walletAction === "refund") {
      await sendNotification(tx.userId, {
        type: "payout_received",
        title: "Transaction Refunded",
        body: `A refund of ₦${(tx.amount / 100).toLocaleString("en-NG")} has been credited to your wallet. Reference: ${tx.reference}`,
        link: "/wallet",
      });
    } else if (walletAction === "credit") {
      await sendNotification(tx.userId, {
        type: "payout_received",
        title: "Deposit Confirmed",
        body: `Your deposit of ₦${(tx.amount / 100).toLocaleString("en-NG")} has been manually approved and added to your wallet.`,
        link: "/wallet",
      });
    } else if (newStatus === "failed") {
      await sendNotification(tx.userId, {
        type: "general",
        title: "Transaction Failed",
        body: `Your transaction (ref: ${tx.reference}) has been marked as failed. Contact support if you have questions.`,
        link: "/transactions",
      });
    }
  } catch (err) {
    console.error("[admin-tx-patch] notification failed:", err);
  }
}