import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/constants";
import { NextRequest } from "next/server";

export async function getSessionUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}
