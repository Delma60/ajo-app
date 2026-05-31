import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const SESSION_COOKIE = "__session";
const FLW_API = "https://api.flutterwave.com/v3";

// Simple in-memory cache so we don't hammer the Flutterwave API on every render
let cachedBanks: FlutterwaveBank[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface FlutterwaveBank {
  id: number;
  code: string;
  name: string;
}

async function getSessionUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}

/**
 * GET /api/payments/banks
 * Returns the list of Nigerian banks from Flutterwave, cached for 1 hour.
 * Response: { success: true, data: Array<{ code: string, name: string }> }
 */
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Return from cache if fresh
    if (cachedBanks && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      return Response.json({ success: true, data: cachedBanks, error: null });
    }

    const flwRes = await fetch(`${FLW_API}/banks/NG`, {
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
      },
      // Next.js fetch cache — revalidate hourly at the HTTP layer too
      next: { revalidate: 3600 },
    });

    const flwData = await flwRes.json();

    if (flwData.status !== "success" || !Array.isArray(flwData.data)) {
      console.error("[GET /api/payments/banks] Flutterwave error:", flwData);
      return Response.json(
        { success: false, data: null, error: "Failed to fetch banks list" },
        { status: 502 }
      );
    }

    const banks: FlutterwaveBank[] = (flwData.data as any[]).map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
    }));

    // Sort alphabetically for the dropdown
    banks.sort((a, b) => a.name.localeCompare(b.name));

    cachedBanks = banks;
    cacheTimestamp = Date.now();

    return Response.json({ success: true, data: banks, error: null });
  } catch (err) {
    console.error("[GET /api/payments/banks]", err);
    return Response.json(
      { success: false, data: null, error: "Failed to fetch banks list" },
      { status: 500 }
    );
  }
}