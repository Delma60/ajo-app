import { NextRequest } from "next/server";
import { CircleService } from "@/lib/services/circle-service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const service = new CircleService();
    await service.sendContributionReminders();
    return Response.json({ success: true, data: null, error: null });
  } catch (err) {
    console.error("[CRON send-reminders]", err);
    return Response.json(
      { success: false, data: null, error: "Reminder sending failed" },
      { status: 500 }
    );
  }
}