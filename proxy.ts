// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getSettings } from "@/lib/services/settings-service";


const SESSION_COOKIE_NAME = "__session";

// Routes that require authentication
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/circles",
  "/wallet",
  "/transactions",
  "/investments",
  "/settings",
  "/notifications",
];

// Dashboard routes that also require onboarding to be complete
// /onboarding itself is excluded so the user can actually reach it
const REQUIRES_ONBOARDING_COMPLETE = [
  "/dashboard",
  "/circles",
  "/wallet",
  "/transactions",
  "/investments",
  "/settings",
  "/notifications",
];

// Routes that authenticated users should NOT see
const AUTH_ONLY_ROUTES = ["/login", "/register"];

// Admin-only routes
const ADMIN_PREFIXES = ["/admin"];

// ─── Session helpers ──────────────────────────────────────────────────────────

interface SessionUser {
  uid: string;
  email?: string;
  role?: string;
  onboardingComplete?: boolean;
}

async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

    // Fetch onboardingComplete and role from Firestore
    // We do a lightweight get — only the fields we need
    const userSnap = await adminDb
      .collection("users")
      .doc(decoded.uid)
      .get();

    if (!userSnap.exists) {
      // Session cookie is valid but user doc missing — treat as unauthenticated
      return null;
    }

    const data = userSnap.data()!;

    return {
      uid: decoded.uid,
      email: decoded.email,
      role: data.role as string | undefined,
      onboardingComplete: data.onboardingComplete as boolean | undefined,
    };
  } catch {
    return null;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, static files, and Next internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionUser = await getSessionUser(request);

  // ── Maintenance mode check ─────────────────────────────────────────────────
  // Allow admins and unauthenticated users to see login/register, but
  // redirect non-admin authenticated users to maintenance page
  try {
    const settings = await getSettings();
    if (settings.maintenance.maintenanceMode) {
      // Allow login/register/admin routes even in maintenance mode
      if (
        !pathname.startsWith("/login") &&
        !pathname.startsWith("/register") &&
        !pathname.startsWith("/admin")
      ) {
        // If user is authenticated and is not an admin, redirect to maintenance
        if (sessionUser && sessionUser.role !== "admin") {
          const maintenanceUrl = new URL("/maintenance", request.url);
          return NextResponse.redirect(maintenanceUrl);
        }
      }
    }
  } catch (err) {
    console.error("[middleware] Failed to check maintenance mode:", err);
    // Fail open — allow request to proceed
  }

  // ── Redirect authenticated users away from login/register ──────────────────
  if (AUTH_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    if (sessionUser) {
      // Admins should not be sent to user dashboards
      if (sessionUser.role === "admin") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }

      // If they're authenticated but haven't finished onboarding,
      // send them to onboarding rather than dashboard
      if (sessionUser.onboardingComplete === false) {
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // ── Protect dashboard/app routes ───────────────────────────────────────────
  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!sessionUser) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Prevent admin users from accessing user-only routes
    if (sessionUser.role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    // Authenticated but onboarding not complete → force to onboarding
    // Exception: /onboarding itself must be reachable
    if (
      sessionUser.onboardingComplete === false &&
      REQUIRES_ONBOARDING_COMPLETE.some((p) => pathname.startsWith(p))
    ) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  // ── Onboarding route: only accessible while not complete ───────────────────
  if (pathname.startsWith("/onboarding")) {
    if (!sessionUser) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", "/onboarding");
      return NextResponse.redirect(loginUrl);
    }

    // Admins shouldn't access onboarding — send them to admin
    if (sessionUser.role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    // If they've already finished onboarding, don't let them back in
    if (sessionUser.onboardingComplete === true) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // ── Admin route guard ──────────────────────────────────────────────────────
  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!sessionUser) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Role check in middleware — no need to hit Firestore again in the layout
    if (sessionUser.role !== "admin") {
      // Redirect non-admins to dashboard with a clear signal
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};