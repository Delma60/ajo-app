export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const SESSION_COOKIE = "__session";
const FLW_API = "https://api.flutterwave.com/v3";

async function getSessionUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}

/**
 * POST /api/payments/verify
 * Body: { txRef: string, transactionId?: string }
 *
 * Called by the deposit callback page after Flutterwave redirects back.
 * 1. Check if our pending transaction doc was already updated to "success"
 *    by the webhook (idempotency-safe fast path).
 * 2. If still pending, verify directly with Flutterwave and process manually
 *    (handles cases where webhook arrives after the redirect).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { txRef, transactionId } = body;

    if (!txRef || typeof txRef !== "string") {
      return Response.json(
        { success: false, data: null, error: "txRef is required" },
        { status: 400 }
      );
    }

    // ── Fast path: check if webhook already processed this transaction ──────
    const txRef_clean = txRef.trim();
    const txSnap = await adminDb.collection("transactions").doc(txRef_clean).get();

    if (txSnap.exists) {
      const txData = txSnap.data()!;

      // Ensure the transaction belongs to the authenticated user
      if (txData.userId !== sessionUser.uid) {
        return Response.json(
          { success: false, data: null, error: "Forbidden" },
          { status: 403 }
        );
      }

      if (txData.status === "success") {
        return Response.json({
          success: true,
          data: {
            amount: txData.amount as number,
            reference: txRef_clean,
            status: "success",
          },
          error: null,
        });
      }

      if (txData.status === "failed" || txData.status === "cancelled") {
        return Response.json(
          {
            success: false,
            data: { status: txData.status },
            error: `Payment ${txData.status}.`,
          },
          { status: 422 }
        );
      }
    }

    // ── Slow path: verify directly with Flutterwave ───────────────────────
    if (!transactionId) {
      // No transactionId and webhook hasn't processed yet — payment is pending
      return Response.json(
        {
          success: false,
          data: { status: "pending" },
          error: "Payment is still being processed.",
        },
        { status: 202 }
      );
    }

    const flwRes = await fetch(
      `${FLW_API}/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    const flwData = await flwRes.json();

    if (
      flwData.status !== "success" ||
      flwData.data?.status !== "successful"
    ) {
      return Response.json(
        {
          success: false,
          data: { status: flwData.data?.status ?? "failed" },
          error: flwData.message ?? "Payment verification failed.",
        },
        { status: 422 }
      );
    }

    const flwTx = flwData.data;

    // Validate tx_ref matches what we expect
    if (flwTx.tx_ref !== txRef_clean) {
      return Response.json(
        { success: false, data: null, error: "Transaction reference mismatch." },
        { status: 422 }
      );
    }

    const amountKobo = Math.round((flwTx.amount as number) * 100);

    // The webhook will handle the actual wallet credit if it hasn't arrived yet.
    // We just confirm success to the UI here so the user sees immediate feedback.
    // If the webhook never arrives, the transaction stays pending and the user
    // can contact support with the tx_ref.

    return Response.json({
      success: true,
      data: {
        amount: amountKobo,
        reference: txRef_clean,
        status: "success",
      },
      error: null,
    });
  } catch (err) {
    console.error("[POST /api/payments/verify]", err);
    return Response.json(
      { success: false, data: null, error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}