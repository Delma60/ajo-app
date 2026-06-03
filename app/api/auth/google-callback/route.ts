/**
 * Google OAuth callback handler for the Expo mobile app.
 *
 * Flow:
 *   Google → redirects here with ?code=...&state=...
 *   We exchange the code for tokens via Google's token endpoint
 *   We find/create the Firebase user via Admin SDK
 *   We set the session cookie
 *   We redirect to the custom scheme: mobileapp://auth-complete
 *   The in-app browser sees the custom scheme and closes automatically
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// 14 days — must match your existing session creation in /api/auth/session
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // encoded mobileapp://auth-complete

  // Always redirect to the app — even on error — so the browser closes
  const appSchemeBase = "mobileapp://auth-complete";

  if (!code) {
    console.error("[google-callback] Missing code param");
    return NextResponse.redirect(`${appSchemeBase}?error=missing_code`);
  }

  try {
    // ── 1. Exchange code for tokens ─────────────────────────────────────────
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-callback`;

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[google-callback] Token exchange failed:", err);
      return NextResponse.redirect(`${appSchemeBase}?error=token_exchange_failed`);
    }

    const { access_token, id_token } = await tokenRes.json();

    // ── 2. Get user info from Google ────────────────────────────────────────
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userInfoRes.ok) {
      console.error("[google-callback] Failed to fetch user info");
      return NextResponse.redirect(`${appSchemeBase}?error=userinfo_failed`);
    }

    const googleUser = await userInfoRes.json();
    const { sub: googleUid, email, name, picture } = googleUser;

    if (!email) {
      return NextResponse.redirect(`${appSchemeBase}?error=no_email`);
    }

    // ── 3. Find or create Firebase user ────────────────────────────────────
    let firebaseUid: string;

    try {
      // Try to get existing user by email
      const existingUser = await adminAuth.getUserByEmail(email);
      firebaseUid = existingUser.uid;
    } catch {
      // User doesn't exist — create them
      const newUser = await adminAuth.createUser({
        email,
        displayName: name,
        photoURL: picture,
        emailVerified: true,
      });
      firebaseUid = newUser.uid;
    }

    // ── 4. Upsert Firestore user doc ────────────────────────────────────────
    const userRef = adminDb.collection("users").doc(firebaseUid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      const referralCode = firebaseUid.slice(0, 8).toUpperCase();
      await userRef.set({
        id: firebaseUid,
        name: name ?? "",
        email,
        phone: "",
        avatarUrl: picture ?? null,
        referralCode,
        referralBonusAmount: 0,
        role: "user",
        status: "active",
        circleIds: [],
        bankAccounts: [],
        onboardingComplete: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Create wallet for new user
      await adminDb.collection("wallets").doc(firebaseUid).set({
        userId: firebaseUid,
        available: 0,
        pending: 0,
        totalSaved: 0,
        totalReceived: 0,
        referralEarnings: 0,
        currency: "NGN",
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Update avatar if it changed
      await userRef.update({
        avatarUrl: picture ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // ── 5. Create Firebase custom token → session cookie ────────────────────
    const customToken = await adminAuth.createCustomToken(firebaseUid);

    // Exchange custom token for an ID token via Firebase REST API
    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      }
    );

    if (!signInRes.ok) {
      console.error("[google-callback] Custom token sign-in failed");
      return NextResponse.redirect(`${appSchemeBase}?error=session_failed`);
    }

    const { idToken } = await signInRes.json();

    // Create session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    // ── 6. Redirect to app scheme — this closes the in-app browser ──────────
    // Decode the state param — it should be mobileapp://auth-complete
    let redirectTarget = appSchemeBase;
    if (state) {
      try {
        const decoded = decodeURIComponent(state);
        if (decoded.startsWith("mobileapp://")) {
          redirectTarget = decoded;
        }
      } catch {}
    }

    const response = NextResponse.redirect(redirectTarget);

    // Set the session cookie on the response
    response.cookies.set("__session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_DURATION_MS / 1000,
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (err) {
    console.error("[google-callback] Unexpected error:", err);
    return NextResponse.redirect(`${appSchemeBase}?error=server_error`);
  }
}