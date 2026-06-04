import { NextRequest } from "next/server";
import { CircleService } from "@/lib/services/circle-service";
import { PaymentService } from "@/lib/services/payment-service";
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
      console.info("[CRON send-reminders] Platform is in maintenance mode, skipping");
      return Response.json({ success: true, data: { skipped: true, reason: "maintenance_mode" }, error: null });
    }

    const circleService = new CircleService();
    const paymentService = new PaymentService();

    // Send contribution reminders
    await circleService.sendContributionReminders();
    console.info("[CRON send-reminders] Contribution reminders sent");

    // Reconcile pending transactions (consolidated into this job)
    const reconcileResult = await paymentService.reconcilePendingTransactions(15);
    console.info("[CRON send-reminders] Pending transactions reconciled", reconcileResult);

    return Response.json({ 
      success: true, 
      data: { 
        reminders_sent: true,
        transactions_reconciled: reconcileResult 
      }, 
      error: null 
    });
  } catch (err) {
    console.error("[CRON send-reminders]", err);
    return Response.json(
      { success: false, data: null, error: "Cron job failed" },
      { status: 500 }
    );
  }
}