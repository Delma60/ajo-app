import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { CircleService } from "@/lib/services/circle-service";
import { buildCreateCircleSchema } from "@/lib/validators/circle";
import { getSettings } from "@/lib/services/settings-service";
import { Circle } from "@/lib/types/circle";

const SESSION_COOKIE = "__session";
const DEFAULT_CIRCLES_LIST_LIMIT = 50;

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
      return Response.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.toLowerCase() ?? "";

    const query = adminDb
      .collection("circles")
      .where("isPrivate", "==", false)
      .where("status", "==", "active")
      .orderBy("createdAt", "desc")
      .limit(DEFAULT_CIRCLES_LIST_LIMIT);

    const snap = await query.get();

    let circles: Partial<Circle>[] = snap.docs.map((doc) => {
      const data = doc.data()! as Partial<Circle>;
      return {
        id: doc.id,
        ...data,
        goal: (data?.contribution || 0) * (data?.maxMembers || 0),
        nextDueDate: (data as any).nextDueDate?.toDate?.()?.toISOString() ?? null,
        nextPayoutDate: (data as any).nextPayoutDate?.toDate?.()?.toISOString() ?? null,
        createdAt: (data as any).createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: (data as any).updatedAt?.toDate?.()?.toISOString() ?? null,
        trustScoreBreakdown: data.trustScoreBreakdown ? {
          ...data.trustScoreBreakdown,
          lastUpdated: (data.trustScoreBreakdown as any).lastUpdated?.toDate?.()?.toISOString() ?? null,
        } : undefined,
      };
    });

    if (q) {
      circles = (circles as Circle[]).filter(
        (c) => c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
      );
    }

    return Response.json({ success: true, data: circles, error: null });
  } catch (err) {
    console.error("[GET /api/circles]", err);
    return Response.json({ success: false, data: null, error: "Failed to fetch circles" }, { status: 500 });
  }
}

// POST /api/circles — create a new circle
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    let parsedData: any;

    try {
      const settings = await getSettings();
      const schema = buildCreateCircleSchema(settings, "KOBO");
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { success: false, data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 400 }
        );
      }
      parsedData = parsed.data;
    } catch (settingsErr) {
      console.error("[POST /api/circles] Failed to validate against settings:", settingsErr);
      const schema = buildCreateCircleSchema(undefined, "KOBO");
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { success: false, data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
          { status: 400 }
        );
      }
      parsedData = parsed.data;
    }

    const {
      name,
      description,
      maxMembers,
      contribution,
      frequency,
      payoutOrder,
      isPrivate,
      invitePermission,
      tags,
      joinFeeEnabled,
      joinFee,
      joinFeeType,
    } = parsedData;

    const service = new CircleService();
    const circle = await service.createCircle(
      sessionUser.uid,
      name,
      description ?? "",
      maxMembers,
      contribution,
      frequency,
      payoutOrder,
      isPrivate,
      invitePermission,
      tags ?? [],
      joinFeeEnabled ?? false,
      // Client sends in KOBO already
      typeof joinFee === "number" ? joinFee : 0,
      joinFeeType ?? "before_joining"
    );

    return Response.json({ success: true, data: { id: circle.id }, error: null }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/circles]", err);
    const isKnown = err?.code && typeof err.code === "string";
    return Response.json(
      { success: false, data: null, error: isKnown ? err.message : "Failed to create circle" },
      { status: isKnown ? 400 : 500 }
    );
  }
}