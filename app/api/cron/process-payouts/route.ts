import { NextRequest } from "next/server";
import { CircleService } from "@/lib/services/circle-service";
import { getSettings } from "@/lib/services/settings-service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Check maintenance mode
    const settings = await getSettings();
    if (settings.maintenance.maintenanceMode) {
      console.info("[CRON process-payouts] Platform is in maintenance mode, skipping");
      return Response.json({ success: true, data: { skipped: true, reason: "maintenance_mode" }, error: null });
    }

    const service = new CircleService();
    await service.processPayouts();
    return Response.json({ success: true, data: null, error: null });
  } catch (err) {
    console.error("[CRON process-payouts]", err);
    return Response.json(
      { success: false, data: null, error: "Payout processing failed" },
      { status: 500 }
    );
  }
}