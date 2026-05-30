import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export const runtime = "nodejs";
const SESSION_COOKIE_NAME = "__session";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/dashboard", "/circles", "/wallet", "/transactions", "/investments", "/settings", "/onboarding", "/notifications"];

// Routes that authenticated users should NOT see
const AUTH_ONLY_ROUTES = ["/login", "/register"];

// Admin-only routes
const ADMIN_PREFIXES = ["/admin"];

async function getSessionUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes and static files
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionUser = await getSessionUser(request);

  // Redirect authenticated users away from login/register
  if (AUTH_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    if (sessionUser) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!sessionUser) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Admin route guard
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!sessionUser) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Role check happens in the admin layout via Firestore
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};