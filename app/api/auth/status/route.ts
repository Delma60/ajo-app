// app/api/auth/status/route.ts
/**
 * Auth Status Endpoint
 * 
 * Allows the client (WebView or browser) to check:
 * - Whether a user is currently authenticated
 * - Basic user metadata (name, email, role)
 * 
 * Used by WebView after native OAuth flow completes to sync auth state.
 */

import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "__session";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      return Response.json(
        {
          authenticated: false,
          user: null,
        },
        { status: 200 }
      );
    }

    // Verify the session cookie
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

    // Fetch user profile
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const userData = userSnap.data();

    return Response.json(
      {
        authenticated: true,
        user: {
          uid: decoded.uid,
          email: decoded.email,
          name: userData?.name,
          role: userData?.role,
          onboardingComplete: userData?.onboardingComplete,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[auth/status] Error:", err);
    // Session invalid or expired
    return Response.json(
      {
        authenticated: false,
        user: null,
      },
      { status: 200 }
    );
  }
}
