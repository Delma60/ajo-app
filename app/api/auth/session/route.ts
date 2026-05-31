// app/api/auth/session/route.ts
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const SESSION_COOKIE_NAME = "__session";
const USER_META_COOKIE_NAME = "__user_meta";
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== "string") {
      return Response.json(
        { success: false, data: null, error: "Missing idToken" },
        { status: 400 }
      );
    }

    // 1. Verify the ID token and create the session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    // 2. Decode the token to get the uid
    const decoded = await adminAuth.verifyIdToken(idToken);

    // 3. Fetch user profile for the meta cookie
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const userData = userSnap.data();

    const cookieStore = await cookies();
    const cookieOptions = {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };

    // 4. Set the httpOnly session cookie (auth)
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: SESSION_DURATION_MS / 1000,
    });

    // 5. Set the readable meta cookie (for middleware fast-path)
    cookieStore.set(
      USER_META_COOKIE_NAME,
      JSON.stringify({
        role: userData?.role ?? "user",
        onboardingComplete: userData?.onboardingComplete ?? false,
      }),
      {
        ...cookieOptions,
        httpOnly: false, // middleware needs to read this without Firestore
        maxAge: SESSION_DURATION_MS / 1000,
      }
    );

    return Response.json({ success: true, data: null, error: null });
  } catch (err) {
    console.error("[session/POST]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to create session" },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
    cookieStore.delete(USER_META_COOKIE_NAME); // clear meta cookie too
    return Response.json({ success: true, data: null, error: null });
  } catch (err) {
    console.error("[session/DELETE]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to delete session" },
      { status: 500 }
    );
  }
}