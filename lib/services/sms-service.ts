/**
 * SMS Service — Termii integration for time-sensitive alerts.
 * Primary channel for contribution reminders and payout notifications.
 * Email is the fallback/receipt channel; SMS is first.
 */

'use server';

import { getSettings } from "@/lib/services/settings-service";

const TERMII_API_URL = "https://api.ng.termii.com/api/sms/send";

interface SendSmsOptions {
  /** Override the default sender ID for a specific message */
  senderId?: string;
}

interface TermiiResponse {
  message_id: string;
  message: string;
  balance: number;
  user: string;
}

/**
 * Send a plain SMS via Termii.
 * Fire-and-forget: logs errors but does not throw, so a failed SMS
 * never disrupts the calling business-logic transaction.
 */
export async function sendSms(
  phone: string,
  message: string,
  options: SendSmsOptions = {}
): Promise<void> {
  // Check if SMS is enabled in platform settings
  try {
    const settings = await getSettings();
    if (!settings.notifications.smsEnabled) {
      console.info("[sms-service] SMS is disabled in platform settings, skipping SMS to", phone);
      return;
    }
  } catch (err) {
    console.error("[sms-service] Failed to load settings, proceeding with SMS attempt:", err);
  }

  const apiKey = process.env.TERMII_API_KEY;
  const senderId = options.senderId ?? process.env.TERMII_SENDER_ID;

  if (!apiKey || !senderId) {
    console.warn("[sms-service] Missing TERMII_API_KEY or TERMII_SENDER_ID — skipping SMS.");
    return;
  }

  // Normalise Nigerian phone numbers to international format
  const normalised = normalisePhone(phone);
  if (!normalised) {
    console.warn(`[sms-service] Invalid phone number: ${phone}`);
    return;
  }

  try {
    const res = await fetch(TERMII_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: normalised,
        from: senderId,
        sms: message,
        type: "plain",
        api_key: apiKey,
        channel: "generic",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[sms-service] Termii HTTP ${res.status}: ${body}`);
      return;
    }

    const data: TermiiResponse = await res.json();
    console.log(`[sms-service] Sent to ${normalised} — message_id: ${data.message_id}`);
  } catch (err) {
    console.error("[sms-service] Failed to send SMS:", err);
  }
}

/**
 * Convenience wrappers for each notification trigger defined in the README.
 * These keep the calling service code clean and allow message copy to be
 * updated in one place.
 */

export async function sendContributionReminder(
  phone: string,
  circleName: string,
  amountKobo: number
): Promise<void> {
  const naira = (amountKobo / 100).toLocaleString("en-NG");
  await sendSms(
    phone,
    `AjoSave: Your contribution of ₦${naira} for "${circleName}" is due. Pay now to avoid a late penalty: ${process.env.NEXT_PUBLIC_APP_URL}/circles`
  );
}

export async function sendContributionReceived(
  phone: string,
  circleName: string,
  amountKobo: number
): Promise<void> {
  const naira = (amountKobo / 100).toLocaleString("en-NG");
  await sendSms(
    phone,
    `AjoSave: ₦${naira} contribution received for "${circleName}". Keep it up!`
  );
}

export async function sendPayoutReceived(
  phone: string,
  circleName: string,
  amountKobo: number
): Promise<void> {
  const naira = (amountKobo / 100).toLocaleString("en-NG");
  await sendSms(
    phone,
    `AjoSave: 🎉 You received ₦${naira} payout from "${circleName}". Check your wallet: ${process.env.NEXT_PUBLIC_APP_URL}/wallet`
  );
}

export async function sendLatePaymentWarning(
  phone: string,
  circleName: string,
  penaltyKobo: number
): Promise<void> {
  const penalty = (penaltyKobo / 100).toLocaleString("en-NG");
  await sendSms(
    phone,
    `AjoSave: Your contribution to "${circleName}" is overdue. A ₦${penalty} penalty will be applied on payment. Pay now: ${process.env.NEXT_PUBLIC_APP_URL}/circles`
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise a Nigerian phone number to E.164 international format (+234XXXXXXXXXX).
 * Returns null if the number cannot be parsed.
 */
function normalisePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");

  // Already in 234XXXXXXXXXX format
  if (/^234[7-9][0-1]\d{8}$/.test(digits)) {
    return `+${digits}`;
  }

  // Local format: 0XXXXXXXXXX
  if (/^0[7-9][0-1]\d{8}$/.test(digits)) {
    return `+234${digits.slice(1)}`;
  }

  // +234... with leading plus stripped
  if (/^234/.test(digits) && digits.length === 13) {
    return `+${digits}`;
  }

  return null;
}