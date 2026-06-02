import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Event } from "@/lib/types/event";
import { SESSION_COOKIE } from "@/lib/constants";

async function getAdminUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists || userSnap.data()?.role !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/events
 * List all events with pagination and stats (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status");

    let snapshot;
    if (status && status !== "all") {
      snapshot = await adminDb.collection("events").where("status", "==", status).get();
    } else {
      snapshot = await adminDb.collection("events").get();
    }
    const events = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        description: data.description,
        status: data.status,
        triggerType: data.triggerType,
        conditions: data.conditions || {},
        rewardType: data.rewardType,
        rewardAmountKobo: data.rewardAmountKobo,
        badgeId: data.badgeId,
        maxClaimsTotal: data.maxClaimsTotal ?? 0,
        maxClaimsPerUser: data.maxClaimsPerUser ?? 1,
        startDate: data.startDate?.toDate?.()?.toISOString() ?? null,
        endDate: data.endDate?.toDate?.()?.toISOString() ?? null,
        createdBy: data.createdBy,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      } as Event;
    });

    // Basic pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedEvents = events.slice(start, end);

    return NextResponse.json({
      success: true,
      data: paginatedEvents,
      pagination: {
        page,
        limit,
        total: events.length,
        pages: Math.ceil(events.length / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch events",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/events
 * Create a new event (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const adminUser = await getAdminUser(request);
    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();

    const {
      title,
      description,
      triggerType,
      conditions,
      rewardType,
      rewardAmountKobo,
      badgeId,
      maxClaimsTotal,
      maxClaimsPerUser,
      startDate,
      endDate,
    } = body;

    // Validate required fields
    if (!title || !triggerType || !rewardType) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const eventId = adminDb.collection("events").doc().id;
    const event: Event = {
      id: eventId,
      title,
      description,
      status: "draft",
      triggerType,
      conditions: conditions || {},
      rewardType,
      rewardAmountKobo,
      badgeId,
      maxClaimsTotal: maxClaimsTotal || 0,
      maxClaimsPerUser: maxClaimsPerUser || 1,
      startDate: Timestamp.fromDate(new Date(startDate)),
      endDate: Timestamp.fromDate(new Date(endDate)),
      createdBy: adminUser.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await adminDb.collection("events").doc(eventId).set(event as any);

    return NextResponse.json(
      {
        success: true,
        data: event,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create event",
      },
      { status: 500 },
    );
  }
}
