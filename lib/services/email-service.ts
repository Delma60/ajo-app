/**
 * Email Service — Nodemailer integration.
 *
 * Transport: SMTP via environment variables (works with Gmail, Zoho, SendGrid
 * SMTP relay, Resend SMTP, or any standard SMTP provider).
 *
 * Strategy:
 *  - Transactional emails (receipts, payouts, disputes) → direct send
 *  - Time-sensitive alerts (contribution due, late warning) → SMS primary,
 *    email fallback — so email is only dispatched if SMS fails or is disabled
 *
 * All send functions are fire-and-forget: they log errors but never throw,
 * so a failed email never interrupts the calling business-logic transaction.
 *
 * Usage:
 *   import { sendWelcomeEmail } from "@/lib/services/email-service";
 *   void sendWelcomeEmail({ name: "Adaeze", email: "adaeze@example.com" });
 */

import nodemailer, { type Transporter } from "nodemailer";
import type { Options as MailOptions } from "nodemailer/lib/mailer";

// ─── Transport singleton ──────────────────────────────────────────────────────

let _transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const host = process.env.NODEMAILER_HOST;
  const port = parseInt(process.env.NODEMAILER_PORT ?? "465", 10);
  const user = process.env.NODEMAILER_USER;
  const pass = process.env.NODEMAILER_PASS;

  if (!host || !user || !pass) {
    throw new EmailError(
      "MISCONFIGURED",
      "Nodemailer is not fully configured. Set NODEMAILER_HOST, NODEMAILER_USER, and NODEMAILER_PASS."
    );
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  return _transporter;
}

// ─── Custom error ─────────────────────────────────────────────────────────────

export class EmailError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "EmailError";
  }
}

// ─── Core send helper ─────────────────────────────────────────────────────────

const FROM_ADDRESS = process.env.NODEMAILER_FROM ?? '"AjoSave" <hello@ajosave.app>';

/**
 * Low-level send. Fire-and-forget — never throws.
 * Returns true on success, false on failure.
 */
export async function sendEmail(options: MailOptions): Promise<boolean> {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({ from: FROM_ADDRESS, ...options });
    console.log(`[email-service] Sent "${options.subject}" → ${options.to}`);
    return true;
  } catch (err) {
    console.error("[email-service] Failed to send email:", err);
    return false;
  }
}
