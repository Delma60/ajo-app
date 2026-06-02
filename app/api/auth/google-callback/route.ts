// app/api/auth/google-callback/route.ts
//
// Receives the OAuth code from Google, exchanges it for tokens,
// creates a Firebase session, then redirects to the custom app scheme
// so the in-app browser closes and returns control to the native app.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // contains the ajosave:// redirect URI
  const error = searchParams.get('error');

  // Decode the redirect target passed via state
  const redirectTarget = state ? decodeURIComponent(state) : 'ajosave://auth-complete';

  // ── Handle user cancellation ──────────────────────────────────────────────
  if (error || !code) {
    console.error('[google-callback] OAuth error or missing code:', error);
    return NextResponse.redirect(`${redirectTarget}?error=cancelled`);
  }

  try {
    // ── 1. Exchange code for tokens ─────────────────────────────────────────
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`Token exchange failed: ${body}`);
    }

    const { id_token } = await tokenRes.json() as { id_token: string };

    // ── 2. Verify the ID token with Firebase Admin ──────────────────────────
    // This also creates the user in Firebase Auth if it's their first sign-in.
    const firebaseToken = await adminAuth.verifyIdToken(id_token);
    const uid = firebaseToken.uid;

    // ── 3. Ensure user doc exists in Firestore ──────────────────────────────
    // (Your existing signUpWithEmail flow already handles this for new users.
    //  For Google sign-ins, upsert the profile doc here if needed.)
    // await upsertUserDoc(uid, firebaseToken);

    // ── 4. Create a session cookie (14 days) ───────────────────────────────
    const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days in ms
    const sessionCookie = await adminAuth.createSessionCookie(id_token, { expiresIn });

    // ── 5. Set the cookie and redirect back to the custom scheme ────────────
    const response = NextResponse.redirect(redirectTarget);
    response.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn / 1000,
      path: '/',
    });

    return response;

  } catch (err) {
    console.error('[google-callback] Error:', err);
    // Redirect back to app with error — the WebView will re-enable the button
    return NextResponse.redirect(`${redirectTarget}?error=auth_failed`);
  }
}