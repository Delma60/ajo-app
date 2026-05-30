import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { PaymentService } from "@/lib/services/payment-service";
import { z } from "zod";

const SESSION_COOKIE = "__session";

const depositSchema = z.object({
  amount: z.coerce
    .number()
    .int("Amount must be a whole number in kobo")
    .min(50000, "Minimum deposit is ₦500"),
});

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
// Body: { amount: number } — amount in kobo
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
    const parsed = depositSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          data: null,
          error: parsed.error.errors[0]?.message ?? "Invalid input",
        },
        { status: 400 }
      );
    }

    // Fetch user profile for Flutterwave customer object
    const userDoc = await adminDb
      .collection("users")
      .doc(sessionUser.uid)
      .get();

    if (!userDoc.exists) {
      return Response.json(
        { success: false, data: null, error: "User profile not found" },
        { status: 404 }
      );
    }

    const userData = userDoc.data()!;

    const service = new PaymentService();
    const { link, reference } = await service.initializeDeposit(
      sessionUser.uid,
      parsed.data.amount,
      userData.email,
      userData.name
    );

    return Response.json({
      success: true,
      data: { paymentLink: link, reference },
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
      { status: 500 }
    );
  }
}