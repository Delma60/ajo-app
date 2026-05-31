/**
 * Email Service — Nodemailer integration.
 *
 * Transport: SMTP via environment variables (works with Gmail, Zoho, SendGrid
 * SMTP relay, Resend SMTP, or any standard SMTP provider).
 *
 * Required environment variables:
 *   NODEMAILER_HOST    e.g. smtp.gmail.com | smtp.resend.com | smtp.zoho.com
 *   NODEMAILER_PORT    e.g. 465 (SSL) | 587 (TLS/STARTTLS) | 25
 *   NODEMAILER_USER    SMTP username / email address
 *   NODEMAILER_PASS    SMTP password / app password / API key
 *   NODEMAILER_FROM    (optional) "display name" <from@domain.com>
 *                      defaults to "AjoSave" <hello@ajosave.app>
 *
 * Provider-specific notes:
 *   Gmail:   Use an App Password (not your account password).
 *            Enable 2FA first, then generate at myaccount.google.com/apppasswords
 *            HOST=smtp.gmail.com  PORT=465  USER=you@gmail.com  PASS=<app-password>
 *
 *   Resend:  HOST=smtp.resend.com  PORT=465  USER=resend  PASS=<api-key>
 *
 *   Zoho:    HOST=smtp.zoho.com  PORT=465  USER=you@zoho.com  PASS=<app-password>
 *
 *   SendGrid: HOST=smtp.sendgrid.net  PORT=587  USER=apikey  PASS=<api-key>
 *
 * Strategy:
 *  - Transactional emails (receipts, payouts, disputes) → direct send
 *  - Time-sensitive alerts (contribution due, late warning) → SMS primary,
 *    email fallback — so email is only dispatched if SMS fails or is disabled
 *
 * All send functions are fire-and-forget: they log errors but never throw,
 * so a failed email never interrupts the calling business-logic transaction.
 */

import nodemailer, { type Transporter } from "nodemailer";
import type { Options as MailOptions } from "nodemailer/lib/mailer";

// ─── Transport singleton ──────────────────────────────────────────────────────

let _transporter: Transporter | null = null;

/**
 * Build and cache the Nodemailer transporter.
 * Called lazily so missing env vars don't crash the process on boot.
 */
function getTransporter(): Transporter {
  if (_transporter) return _transporter;

  const host = process.env.NODEMAILER_HOST;
  const port = parseInt(process.env.NODEMAILER_PORT ?? "465", 10);
  const user = process.env.NODEMAILER_USER;
  const pass = process.env.NODEMAILER_PASS;

  if (!host || !user || !pass) {
    throw new EmailError(
      "MISCONFIGURED",
      [
        "Nodemailer is not fully configured.",
        "Set the following environment variables in your .env.local:",
        "  NODEMAILER_HOST  — SMTP host (e.g. smtp.gmail.com)",
        "  NODEMAILER_PORT  — SMTP port (465 for SSL, 587 for TLS)",
        "  NODEMAILER_USER  — SMTP username",
        "  NODEMAILER_PASS  — SMTP password or app password",
        "  NODEMAILER_FROM  — (optional) sender address",
      ].join("\n")
    );
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    // port 465 → implicit SSL; anything else → STARTTLS
    secure: port === 465,
    auth: { user, pass },
    // Connection pool settings — safe for serverless (Next.js API routes)
    // because each invocation is isolated, but helps if the same route
    // sends multiple emails in one request.
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    // Generous timeouts to handle slow SMTP relays
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  return _transporter;
}

/**
 * Reset the cached transporter (useful for tests or after config changes).
 */
export function resetTransporter(): void {
  _transporter = null;
}

// ─── Custom error ─────────────────────────────────────────────────────────────

export class EmailError extends Error {
  constructor(
    public readonly code:
      | "MISCONFIGURED"
      | "SEND_FAILED"
      | "CONNECTION_FAILED"
      | "AUTH_FAILED",
    message: string
  ) {
    super(message);
    this.name = "EmailError";
  }
}

// ─── Core send helper ─────────────────────────────────────────────────────────

const FROM_ADDRESS =
  process.env.NODEMAILER_FROM ?? '"AjoSave" <hello@ajosave.app>';

/**
 * Low-level send. Fire-and-forget — never throws.
 * Returns true on success, false on failure.
 */
export async function sendEmail(options: MailOptions): Promise<boolean> {
  // Skip silently in CI / test environments that explicitly opt out
  if (process.env.DISABLE_EMAIL === "true") {
    console.log(
      `[email-service] DISABLE_EMAIL=true — skipping "${options.subject}" → ${options.to}`
    );
    return true;
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({ from: FROM_ADDRESS, ...options });
    console.log(
      `[email-service] Sent "${options.subject}" → ${options.to} (messageId: ${info.messageId})`
    );
    return true;
  } catch (err: unknown) {
    // Parse common SMTP error codes for better log messages
    const message =
      err instanceof Error ? err.message : "Unknown error";
    const code =
      (err as NodeJS.ErrnoException)?.code ??
      (err as { responseCode?: number })?.responseCode;

    if (
      typeof code === "number" &&
      (code === 535 || code === 534 || code === 530)
    ) {
      console.error(
        `[email-service] Authentication failed (SMTP ${code}). ` +
          `Check NODEMAILER_USER and NODEMAILER_PASS. ` +
          `If using Gmail, ensure you're using an App Password, not your account password.`
      );
    } else if (typeof code === "string" && code === "ECONNREFUSED") {
      console.error(
        `[email-service] Connection refused. ` +
          `Check NODEMAILER_HOST (${process.env.NODEMAILER_HOST}) ` +
          `and NODEMAILER_PORT (${process.env.NODEMAILER_PORT}).`
      );
    } else if (typeof code === "string" && code === "ETIMEDOUT") {
      console.error(
        `[email-service] Connection timed out. ` +
          `The SMTP server at ${process.env.NODEMAILER_HOST} is not responding.`
      );
    } else {
      console.error(`[email-service] Failed to send email: ${message}`, err);
    }

    return false;
  }
}

// ─── Connection verification ──────────────────────────────────────────────────

/**
 * Verify SMTP credentials and connectivity.
 * Use this in the admin health-check route or during app startup diagnostics.
 *
 * Returns { ok: true } on success or { ok: false, error: string } on failure.
 */
export async function verifyEmailConnection(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log("[email-service] SMTP connection verified successfully.");
    return { ok: true };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown connection error";
    console.error("[email-service] SMTP verification failed:", message);
    return { ok: false, error: message };
  }
}