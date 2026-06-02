// app/api/auth/google/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Called by the Expo native layer after Google OAuth completes.
 * Receives a Firebase ID token, verifies it, creates a session cookie,
 * upserts the user doc, and redirects into the app.
 *
 * Flow:
 *   Native WebBrowser → Google → Firebase redirect → this route
 *   → sets __session cookie → redirects to /dashboard or /onboarding
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const idToken = searchParams.get("idToken");

  if (!idToken) {
    return NextResponse.redirect(
      new URL("/login?error=missing_token", request.url)
    );
  }

  try {
    // Verify the ID token with Firebase Admin
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Create a session cookie (14 days)
    const expiresIn = 60 * 60 * 24 * 14 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    // Upsert user document in Firestore
    const userRef = adminDb.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();

    let onboardingComplete = false;
    let role = "user";

    if (!userSnap.exists) {
      // First-time Google sign-in — create user + wallet docs
      function generateReferralCode(uid: string) {
        return uid.slice(0, 8).toUpperCase();
      }

      const newUser = {
        id: decoded.uid,
        name: decoded.name ?? "",
        email: decoded.email ?? "",
        phone: "",
        avatarUrl: decoded.picture ?? null,
        referralCode: generateReferralCode(decoded.uid),
        referralBonusAmount: 0,
        role: "user",
        status: "active",
        circleIds: [],
        bankAccounts: [],
        onboardingComplete: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await userRef.set(newUser);

      await adminDb
        .collection("wallets")
        .doc(decoded.uid)
        .set({
          userId: decoded.uid,
          available: 0,
          pending: 0,
          totalSaved: 0,
          totalReceived: 0,
          referralEarnings: 0,
          currency: "NGN",
          updatedAt: FieldValue.serverTimestamp(),
        });

      // Send welcome email (fire-and-forget)
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/welcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: decoded.name ?? "",
          email: decoded.email ?? "",
        }),
      }).catch(console.error);
    } else {
      const userData = userSnap.data()!;
      onboardingComplete = userData.onboardingComplete ?? false;
      role = userData.role ?? "user";

      // Update last-seen timestamp
      await userRef.update({ updatedAt: FieldValue.serverTimestamp() });
    }

    // Determine redirect destination
    const redirectPath =
      role === "admin"
        ? "/admin"
        : !onboardingComplete
        ? "/onboarding"
        : "/dashboard";

    // Set session cookie and redirect
    const response = NextResponse.redirect(
      new URL(redirectPath, request.url)
    );

    response.cookies.set("__session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresIn / 1000, // seconds
      path: "/",
    });

    // Also set a readable meta cookie for client-side role detection
    response.cookies.set(
      "__user_meta",
      encodeURIComponent(JSON.stringify({ role })),
      {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: expiresIn / 1000,
        path: "/",
      }
    );

    return response;
  } catch (err) {
    console.error("[google-callback] Token verification failed:", err);
    return NextResponse.redirect(
      new URL("/login?error=auth_failed", request.url)
    );
  }
}