// app/api/auth/google-callback/route.ts
//
// Receives the OAuth code from Google, exchanges it for tokens,
// creates a Firebase session, then redirects to the custom app scheme
// so the in-app browser closes and returns control to the native app.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIREBASE_SIGNIN_WITH_IDP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`;
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

async function exchangeGoogleCode(code: string, redirectUri: string) {
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`Google token exchange failed: ${body}`);
  }

  return tokenRes.json() as Promise<{ id_token?: string; access_token?: string }>;
}

async function getFirebaseIdTokenFromGoogleTokens(
  googleIdToken: string | undefined,
  googleAccessToken: string | undefined,
  requestUri: string
) {
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    throw new Error('Missing Firebase API key');
  }

  const postBodyParts: string[] = ['providerId=google.com'];
  if (googleIdToken) postBodyParts.push(`id_token=${encodeURIComponent(googleIdToken)}`);
  if (googleAccessToken) postBodyParts.push(`access_token=${encodeURIComponent(googleAccessToken)}`);

  const firebaseRes = await fetch(FIREBASE_SIGNIN_WITH_IDP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestUri,
      returnIdpCredential: true,
      returnSecureToken: true,
      postBody: postBodyParts.join('&'),
    }),
  });

  if (!firebaseRes.ok) {
    const body = await firebaseRes.text();
    throw new Error(`Firebase signInWithIdp failed: ${body}`);
  }

  return firebaseRes.json() as Promise<{ idToken: string }>;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // contains the mobileapp:// redirect URI
  const error = searchParams.get('error');

  // Decode the redirect target passed via state
  const redirectTarget = state ? decodeURIComponent(state) : 'mobileapp://auth-complete';

  // ── Handle user cancellation ──────────────────────────────────────────────
  if (error || !code) {
    console.error('[google-callback] OAuth error or missing code:', error);
    return NextResponse.redirect(`${redirectTarget}?error=cancelled`);
  }

  try {
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-callback`;
    const { id_token: googleIdToken, access_token: googleAccessToken } = await exchangeGoogleCode(code, callbackUrl);

    const { idToken: firebaseIdToken } = await getFirebaseIdTokenFromGoogleTokens(
      googleIdToken,
      googleAccessToken,
      callbackUrl
    );

    const sessionCookie = await adminAuth.createSessionCookie(firebaseIdToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const response = NextResponse.redirect(redirectTarget);
    response.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_MS / 1000,
      path: '/',
    });

    return response;

  } catch (err) {
    console.error('[google-callback] Error:', err);
    return NextResponse.redirect(`${redirectTarget}?error=auth_failed`);
  }
}