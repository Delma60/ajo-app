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
  const rawBody = await request.text();

  const signature = request.headers.get("verif-hash");
  const service = new PaymentService();

  if (!service.verifyWebhookSignature(rawBody, signature)) {
    console.warn("[webhook] Invalid or missing Flutterwave signature");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Bad Request: invalid JSON", { status: 400 });
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