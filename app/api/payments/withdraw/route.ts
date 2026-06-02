import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { PaymentService, PaymentError } from "@/lib/services/payment-service";
import { getWalletSettings } from "@/lib/services/settings-service";
import { withdrawSchema } from "@/lib/validators/payment";

const SESSION_COOKIE = "__session";

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
 * POST /api/payments/withdraw
 * Body: { amount: number (kobo), bankAccountId: string }
 *
 * Validates session and input, debits the wallet inside a transaction,
 * then dispatches a Flutterwave Transfer. Final status is handled by webhook.
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

    let body: any;
    try {
      body = await request.json();
    } catch (err) {
      return Response.json(
        { success: false, data: null, error: "Malformed JSON body" },
        { status: 400 }
      );
    }

    const result = withdrawSchema.safeParse(body);
    if (!result.success) {
      const errorMessage = result.error.issues?.[0]?.message ?? "Invalid request body";
      return Response.json(
        { success: false, data: null, error: errorMessage },
        { status: 400 }
      );
    }
    const { amount, bankAccountId } = result.data;

    const walletSettings = await getWalletSettings();
    if (amount < walletSettings.minWithdrawKobo) {
      return Response.json(
        {
          success: false,
          data: null,
          error: `Minimum withdrawal is ₦${walletSettings.minWithdrawKobo / 100}`,
        },
        { status: 400 }
      );
    }

    const service = new PaymentService();
    const withdrawal = await service.initiateWithdrawal(
      sessionUser.uid,
      amount,
      bankAccountId
    );

    return Response.json({ success: true, data: withdrawal, error: null });
  } catch (err) {
    if (err instanceof PaymentError) {
      return Response.json(
        { success: false, data: null, error: err.message },
        { status: 400 }
      );
    }
    console.error("[POST /api/payments/withdraw]", err);
    return Response.json(
      { success: false, data: null, error: "Withdrawal failed" },
      { status: 500 }
    );
  }
}