export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { PaymentService } from "@/lib/services/payment-service";

/**
 * POST /api/payments/webhook
 * Handles Flutterwave webhook events.
 *
 * Security: Flutterwave sends your "Secret Hash" (set in the dashboard under
 * Webhooks → Secret Hash) in the `verif-hash` header on every request.
 * We compare it directly against FLUTTERWAVE_SECRET_HASH env var.
 *
 * This is NOT an HMAC comparison — it is a plain string comparison.
 * See: https://developer.flutterwave.com/docs/integration-guides/webhooks/
 *
 * Idempotency: PaymentService checks providerReference uniqueness before
 * crediting any wallet, preventing double-credits on retries.
 */
export async function POST(request: NextRequest) {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    console.error("[webhook] Failed to read request body");
    return Response.json({ success: true, data: null, error: "Unreadable body" });
  }

  // Strip BOM if present
  if (rawBody.charCodeAt(0) === 0xfeff) {
    rawBody = rawBody.slice(1);
  }

  if (!rawBody.trim()) {
    return Response.json({ success: true, data: null, error: "Empty body" });
  }

  const signature = request.headers.get("verif-hash");
  const service = new PaymentService();

  if (!service.verifyWebhookSignature(rawBody, signature)) {
    // Log enough context to diagnose without leaking the secret
    console.warn(
      "[webhook] Signature mismatch.",
      `header=${signature ? `"${signature.slice(0, 6)}…"` : "null"}`,
      `FLUTTERWAVE_SECRET_HASH set=${!!process.env.FLUTTERWAVE_SECRET_HASH}`
    );
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error("[webhook] Invalid JSON payload:", err, rawBody?.slice(0, 200));
    return Response.json({ success: true, data: null, error: "Invalid JSON" });
  }

  try {
    await service.handleWebhook(payload);
    return Response.json({ success: true, data: null, error: null });
  } catch (err) {
    // Always 200 to Flutterwave — idempotency guards prevent double-processing.
    console.error("[webhook] handleWebhook error:", err);
    return Response.json({ success: true, data: null, error: null });
  }
}