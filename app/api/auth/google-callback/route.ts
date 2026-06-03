// app/api/auth/google-callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function generateReferralCode(uid: string): string {
  return uid.slice(0, 8).toUpperCase();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state"); // e.g. "mobileapp://auth-complete"
  const error = searchParams.get("error");

  // ── Decode the redirect target from state ──────────────────────────────────
  // state is set by the mobile app when it opens the browser, e.g.
  // "mobileapp://auth-complete"
  const redirectTarget = state ?? "mobileapp://auth-complete";

  if (error || !code) {
    const failUrl = new URL(redirectTarget);
    failUrl.searchParams.set("error", error ?? "no_code");
    return NextResponse.redirect(failUrl.toString());
  }

  try {
    // ── 1. Exchange the authorization code with Google for an ID token ────────
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`);
    }

    const { id_token: idToken } = await tokenRes.json();

    if (!idToken) {
      throw new Error("No id_token in Google response");
    }

    // ── 2. Exchange Google ID token for a Firebase user ────────────────────
    const firebaseRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postBody: `id_token=${idToken}&providerId=google.com`,
          requestUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-callback`,
          returnIdpCredential: true,
          returnSecureToken: true,
        }),
      }
    );

    if (!firebaseRes.ok) {
      throw new Error(`Firebase signIn failed: ${firebaseRes.status}`);
    }

    const firebaseData = await firebaseRes.json();
    const { idToken: firebaseIdToken, localId: uid, email, displayName, photoUrl } = firebaseData;

    // ── 3. Upsert the Firestore user doc ───────────────────────────────────
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      const now = FieldValue.serverTimestamp();
      await userRef.set({
        id: uid,
        name: displayName ?? "",
        email: email ?? "",
        phone: "",
        avatarUrl: photoUrl ?? null,
        referralCode: generateReferralCode(uid),
        referralBonusAmount: 0,
        role: "user",
        status: "active",
        circleIds: [],
        bankAccounts: [],
        onboardingComplete: false,
        createdAt: now,
        updatedAt: now,
      });

      // Create empty wallet
      await adminDb.collection("wallets").doc(uid).set({
        userId: uid,
        available: 0,
        pending: 0,
        totalSaved: 0,
        totalReceived: 0,
        referralEarnings: 0,
        currency: "NGN",
        updatedAt: now,
      });
    }

    // ── 4. Create a Firebase session cookie ────────────────────────────────
    const sessionCookie = await adminAuth.createSessionCookie(firebaseIdToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    // ── 5. Redirect to the app's deep link with session set as cookie ──────
    const successUrl = new URL(redirectTarget);
    successUrl.searchParams.set("session", "ok");
    successUrl.searchParams.set("uid", uid);

    const response = NextResponse.redirect(successUrl.toString(), { status: 307 });

    response.cookies.set("__session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION_MS / 1000,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[google-callback] OAuth error:", err);
    const failUrl = new URL(redirectTarget);
    failUrl.searchParams.set("error", "server_error");
    return NextResponse.redirect(failUrl.toString(), { status: 307 });
  }
}