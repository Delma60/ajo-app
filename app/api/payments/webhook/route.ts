// Force Node.js runtime so `node:crypto` / `crypto` is available.
// Without this, Next.js may attempt to bundle the route for the Edge runtime
// which does not support the Node crypto module.
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { PaymentService } from "@/lib/services/payment-service";

/**
 * POST /api/payments/webhook
 * Handles Flutterwave webhook events.
 *
 * Security: Every request is verified against the HMAC-SHA256 signature
 * in the `verif-hash` header. Requests with an invalid or missing signature
 * are rejected with 401.
 *
 * Idempotency: The PaymentService checks whether a providerReference has
 * already been processed before crediting any wallet, preventing double-credits
 * on duplicate webhook retries (which are common with Flutterwave).
 */
export async function POST(request: NextRequest) {
  // Read raw body for signature verification — must happen before .json()
  let rawBody = await request.text();
  // Remove BOM if present
  if (rawBody.charCodeAt(0) === 0xfeff) {
    rawBody = rawBody.slice(1);
  }
  if (!rawBody.trim()) {
    // Empty body, return 200 so Flutterwave doesn't retry
    return Response.json({ success: true, data: null, error: "Empty body" });
  }
  const signature = request.headers.get("verif-hash");
  const service = new PaymentService();
  if (!service.verifyWebhookSignature(rawBody, signature)) {
    console.warn("[webhook] Invalid or missing Flutterwave signature");
    return new Response("Unauthorized", { status: 401 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    // Always return 200 so Flutterwave doesn't retry, but log the error
    console.error("[webhook] Invalid JSON payload:", err, rawBody?.slice(0, 200));
    return Response.json({ success: true, data: null, error: "Invalid JSON" });
  }
  try {
    await service.handleWebhook(payload);
    return Response.json({ success: true, data: null, error: null });
  } catch (err) {
    // Always return 200 to Flutterwave so they don't keep retrying.
    // Log the error for investigation — the idempotency check prevents damage
    // if the same event is delivered again after a retry.
    console.error("[webhook] handleWebhook error:", err);
    return Response.json({ success: true, data: null, error: null });
  }
}