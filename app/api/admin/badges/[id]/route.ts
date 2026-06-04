import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
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
 * GET /api/admin/badges/[id]
 * Get a single badge by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getAdminUser(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const doc = await adminDb.collection("badges").doc(params.id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Badge not found" },
        { status: 404 }
      );
    }

    const data = doc.data();
    const badge: Badge = {
      id: doc.id,
      name: data?.name,
      description: data?.description,
      iconEmoji: data?.iconEmoji,
      iconUrl: data?.iconUrl,
      rarity: data?.rarity,
      createdAt: data?.createdAt,
    };

    return NextResponse.json({
      success: true,
      data: badge,
    });
  } catch (error) {
    console.error("Error fetching badge:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch badge",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/badges/[id]
 * Update a badge (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (iconEmoji !== undefined) updateData.iconEmoji = iconEmoji;
    if (iconUrl !== undefined) updateData.iconUrl = iconUrl;
    if (rarity !== undefined) updateData.rarity = rarity;

    await adminDb.collection("badges").doc(params.id).update(updateData);

    return NextResponse.json({
      success: true,
      message: "Badge updated",
    });
  } catch (error) {
    console.error("Error updating badge:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update badge",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/badges/[id]
 * Delete a badge (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getAdminUser(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await adminDb.collection("badges").doc(params.id).delete();

    return NextResponse.json({
      success: true,
      message: "Badge deleted",
    });
  } catch (error) {
    console.error("Error deleting badge:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete badge",
      },
      { status: 500 }
    );
  }
}
