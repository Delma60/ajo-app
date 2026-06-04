import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { Badge } from "@/lib/types/event";
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
 * GET /api/admin/badges
 * List all badges (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const snapshot = await adminDb.collection("badges").get();
    const badges = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        description: data.description,
        iconEmoji: data.iconEmoji,
        iconUrl: data.iconUrl,
        rarity: data.rarity,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      } as Badge;
    });

    return NextResponse.json({
      success: true,
      data: badges,
    });
  } catch (error) {
    console.error("Error fetching badges:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch badges",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/badges
 * Create a new badge (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, iconEmoji, iconUrl, rarity } = body;

    if (!name || !rarity) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, rarity" },
        { status: 400 }
      );
    }

    const badgeId = adminDb.collection("badges").doc().id;
    const badge: Badge = {
      id: badgeId,
      name,
      description: description || "",
      iconEmoji,
      iconUrl,
      rarity,
      createdAt: Timestamp.now(),
    };

    await adminDb.collection("badges").doc(badgeId).set(badge as any);

    return NextResponse.json(
      {
        success: true,
        data: badge,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating badge:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create badge",
      },
      { status: 500 }
    );
  }
}
