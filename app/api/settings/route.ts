import { NextResponse } from "next/server";
import { getSettings, serializeSettings } from "@/lib/services/settings-service";

export async function GET() {
  try {
    const settings = await getSettings();
    const data = serializeSettings(settings);
    return NextResponse.json({ success: true, data, error: null });
  } catch (err) {
    console.error("[GET /api/settings]", err);
    return NextResponse.json({ success: false, data: null, error: "Failed to fetch settings" }, { status: 500 });
  }
}
