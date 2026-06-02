import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/firebase/server-auth";
import { getWallet } from "@/lib/services/wallet-service";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
    }

    const wallet = await getWallet(user.uid);
    return NextResponse.json({ success: true, data: wallet, error: null });
  } catch (error) {
    console.error("[GET /api/wallet]", error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Failed to fetch wallet",
      },
      { status: 500 },
    );
  }
}
