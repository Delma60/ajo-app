import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { InvestmentService } from "@/lib/services/investment-service";

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

// GET /api/investments/summary — portfolio summary only
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const service = new InvestmentService();
    const summary = await service.getPortfolioSummary(sessionUser.uid);

    return Response.json({ success: true, data: summary, error: null });
  } catch (err) {
    console.error("[GET /api/investments/summary]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to fetch portfolio summary" },
      { status: 500 }
    );
  }
}