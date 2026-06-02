// app/api/auth/callback/route.ts
/**
 * OAuth Redirect Callback Handler
 * 
 * This endpoint handles Firebase OAuth redirects (Google Sign-In).
 * After the user authenticates with Google, they are redirected here.
 * 
 * Flow:
 * 1. User taps "Sign in with Gmail" in native mobile browser or web
 * 2. Browser opens Google OAuth consent screen
 * 3. User signs in with their Google account
 * 4. Google redirects back to this endpoint
 * 5. We create a session cookie and redirect to dashboard
 * 
 * For WebView:
 * - Mobile app opens OAuth flow in native browser (not WebView)
 * - Native browser handles the OAuth redirect here
 * - Session cookie is set and shared with WebView (sharedCookiesEnabled=true)
 * - WebView detects auth state change and syncs user session
 */

import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "__session";
const USER_META_COOKIE_NAME = "__user_meta";
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export async function GET(request: NextRequest) {
  try {
    // Extract ID token from URL query params
    // Firebase redirect includes the token in the URL
    const { searchParams } = new URL(request.url);
    const idToken = searchParams.get("token") || searchParams.get("idToken");

    if (!idToken) {
      // No token provided; redirect to login
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Verify and decode the ID token
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Create session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    // Fetch user profile
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const userData = userSnap.data();

    const cookieStore = await cookies();
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

    // Set readable meta cookie
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

    // Redirect to dashboard or onboarding
    const redirectPath =
      userData?.onboardingComplete === false ? "/onboarding" : "/dashboard";

    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (err) {
    console.error("[auth/callback] Error:", err);
    // On error, redirect back to login
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }
}

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== "string") {
      return Response.json(
        { success: false, error: "Missing idToken" },
        { status: 400 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const userData = userSnap.data();

    const cookieStore = await cookies();
    const cookieOptions = {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };

    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: SESSION_DURATION_MS / 1000,
    });

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

    return Response.json({
      success: true,
      data: { redirectPath: userData?.onboardingComplete === false ? "/onboarding" : "/dashboard" },
      error: null,
    });
  } catch (err) {
    console.error("[auth/callback/POST]", err);
    return Response.json(
      { success: false, error: "Failed to create session from token" },
      { status: 401 }
    );
  }
}
