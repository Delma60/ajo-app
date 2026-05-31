import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import {
  InvestmentService,
  InvestmentError,
} from "@/lib/services/investment-service";

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

// GET /api/investments/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const service = new InvestmentService();
    const investments = await service.getUserInvestments(sessionUser.uid);
    const investment = investments.find((inv) => inv.id === id);

    if (!investment) {
      return Response.json(
        { success: false, data: null, error: "Investment not found" },
        { status: 404 }
      );
    }

    return Response.json({ success: true, data: investment, error: null });
  } catch (err) {
    console.error("[GET /api/investments/[id]]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to fetch investment" },
      { status: 500 }
    );
  }
}

// PATCH /api/investments/[id] — action: "withdraw"
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action !== "withdraw") {
      return Response.json(
        { success: false, data: null, error: "Invalid action. Only 'withdraw' is supported." },
        { status: 400 }
      );
    }

    const service = new InvestmentService();
    const result = await service.withdrawInvestment(sessionUser.uid, id);

    return Response.json({ success: true, data: result, error: null });
  } catch (err: any) {
    console.error("[PATCH /api/investments/[id]]", err);
    const isKnown = err instanceof InvestmentError;
    return Response.json(
      {
        success: false,
        data: null,
        error: isKnown ? err.message : "Failed to process withdrawal",
      },
      { status: isKnown ? 400 : 500 }
    );
  }
}