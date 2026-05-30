import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

const SESSION_COOKIE_NAME = "__session";
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

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION_MS / 1000,
      path: "/",
    });

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
    return Response.json({ success: true, data: null, error: null });
  } catch (err) {
    console.error("[session/DELETE]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to delete session" },
      { status: 500 }
    );
  }
}