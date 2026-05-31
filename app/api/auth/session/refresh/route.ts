import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;
    if (!sessionCookie) {
      return Response.json({ success: false, error: "No session" }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const userData = userSnap.data();

    cookieStore.set("__user_meta", JSON.stringify({
      role: userData?.role ?? "user",
      onboardingComplete: userData?.onboardingComplete ?? false,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 14 * 24 * 60 * 60,
      path: "/",
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ success: false, error: "Failed to refresh" }, { status: 500 });
  }
}