import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export const runtime = "nodejs";

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
 * POST /api/payments/verify-account
 * Body: { accountNumber: string, bankCode: string }
 *
 * Resolves a Nigerian bank account name via Flutterwave's account resolution API.
 * Returns: { accountName: string, accountNumber: string }
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
    const { accountNumber, bankCode } = body;

    if (
      !accountNumber ||
      typeof accountNumber !== "string" ||
      accountNumber.length !== 10 ||
      !/^\d+$/.test(accountNumber)
    ) {
      return Response.json(
        { success: false, data: null, error: "Account number must be exactly 10 digits" },
        { status: 400 }
      );
    }

    if (!bankCode || typeof bankCode !== "string") {
      return Response.json(
        { success: false, data: null, error: "bankCode is required" },
        { status: 400 }
      );
    }

    const flwRes = await fetch(`${FLW_API}/accounts/resolve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_number: accountNumber,
        account_bank: bankCode,
      }),
    });

    const flwData = await flwRes.json();

    if (flwData.status !== "success" || !flwData.data?.account_name) {
      // Flutterwave returns 200 even for failed resolutions, check the status field
      const errorMsg =
        flwData.message === "Sorry, we could not retrieve account details"
          ? "Account not found. Please check the account number and bank."
          : flwData.message ?? "Could not verify account. Please try again.";

      return Response.json(
        { success: false, data: null, error: errorMsg },
        { status: 422 }
      );
    }

    return Response.json({
      success: true,
      data: {
        accountName: flwData.data.account_name as string,
        accountNumber: flwData.data.account_number as string,
      },
      error: null,
    });
  } catch (err) {
    console.error("[POST /api/payments/verify-account]", err);
    return Response.json(
      { success: false, data: null, error: "Account verification failed. Please try again." },
      { status: 500 }
    );
  }
}