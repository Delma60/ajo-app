import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { CircleService } from "@/lib/services/circle-service";
import { contributeSchema } from "@/lib/validators/circle";

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

// POST /api/circles/[id]/contribute
export async function POST(
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
    const parsed = contributeSchema.safeParse(body);

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

    const service = new CircleService();
    const contribution = await service.makeContribution(
      id,
      sessionUser.uid,
      parsed.data.amount // kobo
    );

    return Response.json({
      success: true,
      data: { contributionId: contribution.id },
      error: null,
    });
  } catch (err: any) {
    console.error("[POST /api/circles/[id]/contribute]", err);
    return Response.json(
      {
        success: false,
        data: null,
        error: err?.message ?? "Contribution failed",
      },
      { status: err?.code ? 400 : 500 }
    );
  }
}