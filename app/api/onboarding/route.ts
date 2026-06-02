import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/firebase/server-auth";
import { triggerOnboardingComplete } from "@/lib/services/event-trigger";
import { serverTimestamp } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await adminDb.collection("users").doc(user.uid).update({
      onboardingComplete: true,
      updatedAt: serverTimestamp(),
    });

    triggerOnboardingComplete(user.uid);

    return NextResponse.json({ success: true, data: null, error: null });
  } catch (error) {
    console.error("[POST /api/onboarding]", error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Failed to complete onboarding",
      },
      { status: 500 },
    );
  }
}
