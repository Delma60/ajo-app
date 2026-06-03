// app/api/auth/google-callback/route.ts

import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
const APP_SCHEME = "mobileapp://auth-complete";

function buildSuccessPage(sessionCookie: string, redirectTarget: string): Response {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Signing you in…</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center;
           justify-content: center; height: 100vh; margin: 0; background: #f9fafb; }
    .card { text-align: center; padding: 32px; }
    .spinner { width: 40px; height: 40px; border: 3px solid #e5e7eb;
               border-top-color: #047857; border-radius: 50%;
               animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { color: #6b7280; font-size: 15px; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <p>Signing you in…</p>
  </div>
  <script>
    // Redirect to the app's custom scheme — this is what closes the in-app browser
    window.location.href = ${JSON.stringify(redirectTarget)};
    
    // Fallback: if the page is still visible after 2s, try again
    setTimeout(function() {
      window.location.replace(${JSON.stringify(redirectTarget)});
    }, 2000);
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Set the session cookie on this response
      "Set-Cookie": `__session=${sessionCookie}; Path=/; Max-Age=${SESSION_DURATION_MS / 1000}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

function buildErrorPage(error: string): Response {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sign-in failed</title>
</head>
<body>
  <script>
    window.location.href = "${APP_SCHEME}?error=${encodeURIComponent(error)}";
    setTimeout(function() {
      window.location.replace("${APP_SCHEME}?error=${encodeURIComponent(error)}");
    }, 1500);
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    console.error("[google-callback] Missing code param");
    return buildErrorPage("missing_code");
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
      return buildErrorPage("token_exchange_failed");
    }

    const { access_token } = await tokenRes.json();

    // ── 2. Get user info ────────────────────────────────────────────────────
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userInfoRes.ok) {
      return buildErrorPage("userinfo_failed");
    }

    const { sub: googleUid, email, name, picture } = await userInfoRes.json();

    if (!email) {
      return buildErrorPage("no_email");
    }

    // ── 3. Find or create Firebase user ────────────────────────────────────
    let firebaseUid: string;

    try {
      const existing = await adminAuth.getUserByEmail(email);
      firebaseUid = existing.uid;
    } catch {
      const created = await adminAuth.createUser({
        email,
        displayName: name,
        photoURL: picture,
        emailVerified: true,
      });
      firebaseUid = created.uid;
    }

    // ── 4. Upsert Firestore user + wallet ───────────────────────────────────
    const userRef = adminDb.collection("users").doc(firebaseUid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      await userRef.set({
        id: firebaseUid,
        name: name ?? "",
        email,
        phone: "",
        avatarUrl: picture ?? null,
        referralCode: firebaseUid.slice(0, 8).toUpperCase(),
        referralBonusAmount: 0,
        role: "user",
        status: "active",
        circleIds: [],
        bankAccounts: [],
        onboardingComplete: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

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
      await userRef.update({
        avatarUrl: picture ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // ── 5. Create session cookie via custom token ───────────────────────────
    const customToken = await adminAuth.createCustomToken(firebaseUid);

    const signInRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }),
      }
    );

    if (!signInRes.ok) {
      return buildErrorPage("session_failed");
    }

    const { idToken } = await signInRes.json();

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    let redirectTarget = APP_SCHEME;
    if (state) {
      try {
        const decoded = decodeURIComponent(state);
        if (decoded.startsWith("mobileapp://")) {
          redirectTarget = decoded;
        }
      } catch (err) {
        console.warn("[google-callback] Failed to decode state", err);
      }
    }

    // ── 6. Return HTML page that redirects to app scheme ────────────────────
    // A client-side redirect (window.location) works reliably in Chrome Custom
    // Tabs / ASWebAuthenticationSession. A server-side 307 to a custom scheme
    // can be swallowed by Vercel edge middleware or the browser's security model.
    return buildSuccessPage(sessionCookie, redirectTarget);
  } catch (err) {
    console.error("[google-callback] Unexpected error:", err);
    return buildErrorPage("server_error");
  }
}