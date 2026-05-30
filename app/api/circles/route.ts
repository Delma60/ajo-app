import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { CircleService } from "@/lib/services/circle-service";
import { createCircleSchema } from "@/lib/validators/circle";
import { Circle } from "@/lib/types/circle";

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

// GET /api/circles — list public circles (authenticated)
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.toLowerCase() ?? "";

    let query = adminDb
      .collection("circles")
      .where("isPrivate", "==", false)
      .where("status", "==", "active")
      .orderBy("createdAt", "desc")
      .limit(50);

    const snap = await query.get();

    let circles:Partial<Circle[]> = [];
    circles = snap.docs.map((doc) => {
      const data = doc.data()! as Partial<Circle>; 
      return {
        id: doc.id,
        ...data,
        // Derive goal at read time — never stored
        goal: (data?.contribution || 0) * (data?.maxMembers || 0),
        // Convert Timestamps for JSON serialization
        nextDueDate: data.nextDueDate?.toDate?.()?.toISOString() ?? null,
        nextPayoutDate: data.nextPayoutDate?.toDate?.()?.toISOString() ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
        trustScoreBreakdown: data.trustScoreBreakdown ? {
          ...data.trustScoreBreakdown,
          lastUpdated: data.trustScoreBreakdown.lastUpdated?.toDate?.()?.toISOString() ?? null,
        } : undefined,
      };
    });

    // In-memory search filter (Firestore doesn't support full-text search)
    if (q) {
      circles = (circles as Circle[]).filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
      );
    }

    return Response.json({ success: true, data: circles, error: null });
  } catch (err) {
    console.error("[GET /api/circles]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to fetch circles" },
      { status: 500 }
    );
  }
}

// POST /api/circles — create a new circle
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
    const parsed = createCircleSchema.safeParse(body);

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

    const {
      name,
      description,
      maxMembers,
      contribution,
      frequency,
      payoutOrder,
      isPrivate,
      tags,
    } = parsed.data;

    const service = new CircleService();
    const circle = await service.createCircle(
      sessionUser.uid,
      name,
      description ?? "",
      maxMembers,
      contribution, // already in kobo from validator
      frequency,
      payoutOrder,
      isPrivate,
      tags ?? []
    );

    return Response.json(
      {
        success: true,
        data: { id: circle.id },
        error: null,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[POST /api/circles]", err);
    const isKnown = err?.code && typeof err.code === "string";
    return Response.json(
      {
        success: false,
        data: null,
        error: isKnown ? err.message : "Failed to create circle",
      },
      { status: isKnown ? 400 : 500 }
    );
  }
}