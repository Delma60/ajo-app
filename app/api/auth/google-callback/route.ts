/**
 * GET /api/auth/google-callback
 *
 * Receives the authorization code from Google after the user approves the
 * OAuth consent screen. This route:
 *   1. Decodes the `state` param (which is the Expo deep-link redirect target)
 *   2. Exchanges the authorization `code` for Google tokens
 *   3. Signs the Google ID token into Firebase via the REST Identity Toolkit API
 *   4. Upserts the Firestore user doc + wallet (first-time Google sign-in)
 *   5. Creates a Firebase session cookie via the Admin SDK
 *   6. Sets the cookie on the response and 307-redirects to the deep-link URI
 *      so `expo-web-browser` closes the in-app browser automatically
 *
 * The Expo app opens this flow via:
 *   WebBrowser.openAuthSessionAsync(googleUrl, 'mobileapp://auth-complete')
 *
 * On success the browser sees `mobileapp://auth-complete?session=ok` and
 * closes, resolving the promise in App.js with { type: 'success' }. The
 * WebView is then reloaded and picks up the __session cookie.
 *
 * Environment variables required (server-only — never expose to the client):
 *   GOOGLE_CLIENT_ID       — from Google Cloud Console → OAuth 2.0 credentials
 *   GOOGLE_CLIENT_SECRET   — same credential
 *   NEXT_PUBLIC_APP_URL    — the Vercel deployment URL (already set)
 *   NEXT_PUBLIC_FIREBASE_API_KEY — already set (used for Identity Toolkit calls)
 *
 * Google Cloud Console setup:
 *   Authorised redirect URIs must include:
 *     https://ajo-app-ebo2.vercel.app/api/auth/google-callback
 *     http://localhost:3000/api/auth/google-callback  ← dev
 */

import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

// 14-day session cookie lifetime (ms for createSessionCookie, seconds for Set-Cookie)
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
const SESSION_DURATION_S = SESSION_DURATION_MS / 1000;

// Fallback redirect target when `state` is missing or malformed
const FALLBACK_REDIRECT = "mobileapp://auth-complete";

function generateReferralCode(uid: string): string {
  return uid.slice(0, 8).toUpperCase();
}

/**
 * Redirect to the deep-link target with an error param so the Expo app
 * can surface feedback without crashing.
 */
function errorRedirect(target: string, code: string): NextResponse {
  const url = new URL(target);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url.toString(), { status: 307 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const rawState = searchParams.get("state"); // URL-encoded deep-link, e.g. "mobileapp%3A%2F%2Fauth-complete"
  const oauthError = searchParams.get("error");

  // Decode the state param — this is where the in-app browser will be redirected
  // App.js passes encodeURIComponent('mobileapp://auth-complete') as the state
  let redirectTarget = FALLBACK_REDIRECT;
  if (rawState) {
    try {
      const decoded = decodeURIComponent(rawState);
      // Safety check: only allow our own custom scheme
      if (decoded.startsWith("mobileapp://")) {
        redirectTarget = decoded;
      }
    } catch {
      // Keep fallback
    }
  }

  // ── Google returned an error (user denied, etc.) ───────────────────────────
  if (oauthError || !code) {
    console.warn("[google-callback] OAuth error from Google:", oauthError ?? "no_code");
    return errorRedirect(redirectTarget, oauthError ?? "no_code");
  }

  // ── Validate required env vars early so errors are obvious ────────────────
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!clientId || !clientSecret || !appUrl || !firebaseApiKey) {
    console.error(
      "[google-callback] Missing env vars:",
      JSON.stringify({
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasAppUrl: !!appUrl,
        hasFirebaseApiKey: !!firebaseApiKey,
      })
    );
    return errorRedirect(redirectTarget, "server_misconfigured");
  }

  const redirectUri = `${appUrl}/api/auth/google-callback`;

  try {
    // ── Step 1: Exchange the code for Google tokens ────────────────────────
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error("[google-callback] Token exchange failed:", tokenRes.status, body);
      return errorRedirect(redirectTarget, "token_exchange_failed");
    }

    const tokenData: { id_token?: string; access_token?: string; error?: string } =
      await tokenRes.json();

    if (!tokenData.id_token) {
      console.error("[google-callback] No id_token in token response:", tokenData);
      return errorRedirect(redirectTarget, "no_id_token");
    }

    // ── Step 2: Sign into Firebase with the Google ID token ───────────────
    // We use the Firebase REST Identity Toolkit instead of the client SDK
    // because this is a server-side route (no browser context).
    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postBody: `id_token=${tokenData.id_token}&providerId=google.com`,
          // requestUri must exactly match an authorised redirect URI in Firebase Auth
          // settings AND in the Google Cloud Console OAuth credential.
          requestUri: redirectUri,
          returnIdpCredential: true,
          returnSecureToken: true,
        }),
      }
    );

    if (!signInRes.ok) {
      const body = await signInRes.text();
      console.error("[google-callback] Firebase signInWithIdp failed:", signInRes.status, body);
      return errorRedirect(redirectTarget, "firebase_signin_failed");
    }

    const firebaseData: {
      idToken?: string;
      localId?: string;
      email?: string;
      displayName?: string;
      photoUrl?: string;
      error?: { message: string };
    } = await signInRes.json();

    if (firebaseData.error || !firebaseData.idToken || !firebaseData.localId) {
      console.error("[google-callback] Firebase signIn error:", firebaseData.error);
      return errorRedirect(redirectTarget, "firebase_user_missing");
    }

    const { idToken: firebaseIdToken, localId: uid, email, displayName, photoUrl } = firebaseData;

    // ── Step 3: Upsert Firestore user doc + wallet (first-time only) ──────
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      const now = FieldValue.serverTimestamp();
      const batch = adminDb.batch();

      batch.set(userRef, {
        id: uid,
        name: displayName ?? "",
        email: email ?? "",
        phone: "",
        avatarUrl: photoUrl ?? null,
        referralCode: generateReferralCode(uid),
        referredBy: null,
        referralBonusAmount: 0,
        role: "user",
        status: "active",
        circleIds: [],
        bankAccounts: [],
        onboardingComplete: false,
        createdAt: now,
        updatedAt: now,
      });

      batch.set(adminDb.collection("wallets").doc(uid), {
        userId: uid,
        available: 0,
        pending: 0,
        totalSaved: 0,
        totalReceived: 0,
        referralEarnings: 0,
        currency: "NGN",
        updatedAt: now,
      });

      await batch.commit();

      // Fire-and-forget: send welcome email via the existing API route
      fetch(`${appUrl}/api/auth/welcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName ?? "", email: email ?? "" }),
      }).catch((err) => {
        console.warn("[google-callback] Welcome email failed (non-fatal):", err);
      });
    }

    // ── Step 4: Create a Firebase session cookie ───────────────────────────
    // The Admin SDK signs a session cookie that the middleware can verify.
    const sessionCookie = await adminAuth.createSessionCookie(firebaseIdToken!, {
      expiresIn: SESSION_DURATION_MS,
    });

    // ── Step 5: Redirect to the Expo deep-link so the browser closes ───────
    // expo-web-browser watches for 'mobileapp://' and dismisses itself when
    // it appears in the navigation. The cookie is set on the response so the
    // WebView picks it up on next load (sharedCookiesEnabled must be true in App.js).
    const successUrl = new URL(redirectTarget);
    successUrl.searchParams.set("session", "ok");

    const response = NextResponse.redirect(successUrl.toString(), {
      status: 307,
    });

    response.cookies.set("__session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // 'lax' lets the cookie be sent when the WebView reloads after the
      // in-app browser closes (same-site, top-level navigation).
      sameSite: "lax",
      maxAge: SESSION_DURATION_S,
      path: "/",
    });

    // Also set a readable meta cookie so the Next.js login form can detect
    // the user's role for the post-login redirect (matches the pattern in
    // components/auth/login-form.tsx).
    response.cookies.set(
      "__user_meta",
      encodeURIComponent(JSON.stringify({ uid, role: "user" })),
      {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_DURATION_S,
        path: "/",
      }
    );

    console.log("[google-callback] Session created for uid:", uid);
    return response;
  } catch (err) {
    console.error("[google-callback] Unexpected error:", err);
    return errorRedirect(redirectTarget, "server_error");
  }
}