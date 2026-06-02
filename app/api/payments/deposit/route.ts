import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { PaymentService } from "@/lib/services/payment-service";
import { getWalletSettings } from "@/lib/services/settings-service";
import { depositSchema } from "@/lib/validators/payment";

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

// POST /api/payments/deposit
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

    const result = depositSchema.safeParse(body);
    if (!result.success) {
      const errorMessage = result.error.issues?.[0]?.message ?? "Invalid request body";
      return Response.json(
        { success: false, data: null, error: errorMessage },
        { status: 400 }
      );
    }

    const { amount, email, name } = result.data;
    const walletSettings = await getWalletSettings();
    if (amount < walletSettings.minDepositKobo) {
      return Response.json(
        {
          success: false,
          data: null,
          error: `Minimum deposit is ₦${walletSettings.minDepositKobo / 100}`,
        },
        { status: 400 }
      );
    }

    const service = new PaymentService();
    const { paymentLink, reference } = await service.initializeDeposit(
      sessionUser.uid,
      amount, // kobo
      email ?? sessionUser.email ?? "",
      name ?? sessionUser.name ?? "AjoSave User"
    );

    return Response.json({
      success: true,
      data: { paymentLink, reference },
      error: null,
    });
  } catch (err: any) {
    console.error("[POST /api/payments/deposit]", err);
    return Response.json(
      {
        success: false,
        data: null,
        error: err?.message ?? "Failed to initialize deposit",
      },
      { status: err?.code ? 400 : 500 }
    );
  }
}