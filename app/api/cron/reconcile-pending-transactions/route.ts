export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { PaymentService } from "@/lib/services/payment-service";
import { getSettings } from "@/lib/services/settings-service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const settings = await getSettings();
    if (settings.maintenance.maintenanceMode) {
      console.info(
        "[CRON reconcile-pending-transactions] Platform is in maintenance mode, skipping"
      );
      return Response.json({
        success: true,
        data: { skipped: true, reason: "maintenance_mode" },
        error: null,
      });
    }

    const service = new PaymentService();
    const result = await service.reconcilePendingTransactions(15);
    return Response.json({ success: true, data: result, error: null });
  } catch (err) {
    console.error("[CRON reconcile-pending-transactions]", err);
    return Response.json(
      { success: false, data: null, error: "Pending transaction reconciliation failed" },
      { status: 500 }
    );
  }
}
