// app/api/auth/callback/google/route.ts
/**
 * Google OAuth Redirect Callback
 * 
 * Handles Firebase authentication after Google OAuth sign-in.
 * Called by:
 * - Web browser redirect from Google OAuth consent
 * - Expo WebView/mobile app after native browser OAuth
 * 
 * Accepts token via:
 * - GET: ?token=<idToken> or ?idToken=<idToken>
 * - POST: { idToken: "<idToken>" }
 */

import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "__session";
const USER_META_COOKIE_NAME = "__user_meta";
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

async function createSessionFromToken(
  idToken: string,
  request: NextRequest
): Promise<{ sessionCookie: string; userData: any } | null> {
  try {
    // Verify and decode the ID token via Firebase Admin SDK
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Fetch user profile from Firestore
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const userData = userSnap.data();

    // Create session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    return { sessionCookie, userData };
  } catch (err) {
    console.error("[auth/callback/google] Token verification failed:", err);
    return null;
  }
}

function setSessionCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  sessionCookie: string,
  userData: any
) {
  const cookieOptions = {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  // Set httpOnly session cookie
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    ...cookieOptions,
    httpOnly: true,
    maxAge: SESSION_DURATION_MS / 1000,
  });

  // Set readable meta cookie for middleware fast-path
  cookieStore.set(
    USER_META_COOKIE_NAME,
    JSON.stringify({
      role: userData?.role ?? "user",
      onboardingComplete: userData?.onboardingComplete ?? false,
    }),
    {
      ...cookieOptions,
      httpOnly: false,
      maxAge: SESSION_DURATION_MS / 1000,
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    // Extract ID token from URL query params
    const { searchParams } = new URL(request.url);
    const idToken = searchParams.get("token") || searchParams.get("idToken");

    if (!idToken) {
      return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
    }

    const result = await createSessionFromToken(idToken, request);
    if (!result) {
      return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
    }

    const { sessionCookie, userData } = result;
    const cookieStore = await cookies();
    setSessionCookies(cookieStore, sessionCookie, userData);

    // Redirect to dashboard or onboarding based on user state
    const redirectPath =
      userData?.onboardingComplete === false ? "/onboarding" : "/dashboard";

    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (err) {
    console.error("[auth/callback/google/GET] Error:", err);
    return NextResponse.redirect(new URL("/login?error=callback_failed", request.url));
  }
}

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== "string") {
      return Response.json(
        { success: false, error: "Missing or invalid idToken" },
        { status: 400 }
      );
    }

    const result = await createSessionFromToken(idToken, request);
    if (!result) {
      return Response.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const { sessionCookie, userData } = result;
    const cookieStore = await cookies();
    setSessionCookies(cookieStore, sessionCookie, userData);

    return Response.json({
      success: true,
      data: {
        user: {
          uid: userData?.id,
          email: userData?.email,
          name: userData?.name,
          role: userData?.role,
          onboardingComplete: userData?.onboardingComplete,
        },
        redirectPath:
          userData?.onboardingComplete === false ? "/onboarding" : "/dashboard",
      },
      error: null,
    });
  } catch (err) {
    console.error("[auth/callback/google/POST] Error:", err);
    return Response.json(
      { success: false, error: "Failed to create session" },
      { status: 500 }
    );
  }
}
