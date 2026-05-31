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

// GET /api/investments — list user investments + portfolio summary
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
    const [investments, summary] = await Promise.all([
      service.getUserInvestments(sessionUser.uid),
      service.getPortfolioSummary(sessionUser.uid),
    ]);

    return Response.json({
      success: true,
      data: { investments, summary },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/investments]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to fetch investments" },
      { status: 500 }
    );
  }
}

// POST /api/investments — create a new investment
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
    const { packageId, principalKobo } = body;

    if (!packageId || typeof packageId !== "string") {
      return Response.json(
        { success: false, data: null, error: "packageId is required" },
        { status: 400 }
      );
    }

    if (
      !principalKobo ||
      typeof principalKobo !== "number" ||
      principalKobo <= 0
    ) {
      return Response.json(
        {
          success: false,
          data: null,
          error: "principalKobo must be a positive number",
        },
        { status: 400 }
      );
    }

    const service = new InvestmentService();
    const investment = await service.createInvestment(
      sessionUser.uid,
      packageId,
      principalKobo
    );

    return Response.json(
      {
        success: true,
        data: { id: investment.id },
        error: null,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[POST /api/investments]", err);
    const isKnown = err instanceof InvestmentError;
    return Response.json(
      {
        success: false,
        data: null,
        error: isKnown ? err.message : "Failed to create investment",
      },
      { status: isKnown ? 400 : 500 }
    );
  }
}