/**
 * Email Sender Functions
 *
 * Thin wrappers that compose the template builder with sendEmail().
 * These are the functions imported by service layer code (circle-service,
 * payment-service, dispute-service, etc.).
 *
 * All functions are fire-and-forget (return void, never throw).
 * They respect the user's email notification preferences before sending.
 *
 * Import pattern:
 *   import * as emailSender from "@/lib/email/senders";
 *   void emailSender.welcome({ name, email });
 */

import { sendEmail } from "@/lib/services/email-service";
import {
  buildWelcomeEmail,
  buildContributionReminderEmail,
  buildContributionReceiptEmail,
  buildPayoutEmail,
  buildLatePaymentEmail,
  buildCircleInviteEmail,
  buildDisputeAdminEmail,
  buildDisputeConfirmEmail,
  buildDisputeResolvedEmail,
  type WelcomeEmailParams,
  type ContributionReminderEmailParams,
  type ContributionReceiptEmailParams,
  type PayoutEmailParams,
  type LatePaymentEmailParams,
  type CircleInviteEmailParams,
  type DisputeAdminEmailParams,
  type DisputeConfirmEmailParams,
  type DisputeResolvedEmailParams,
} from "@/lib/email/templates";

// ─── 1. Welcome ───────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  const { subject, html, text } = buildWelcomeEmail(params);
  void sendEmail({ to: params.email, subject, html, text });
}

// ─── 2. Contribution Reminder ─────────────────────────────────────────────────

export async function sendContributionReminderEmail(
  email: string,
  params: ContributionReminderEmailParams
): Promise<void> {
  const { subject, html, text } = buildContributionReminderEmail(params);
  void sendEmail({ to: email, subject, html, text });
}

// ─── 3. Contribution Receipt ──────────────────────────────────────────────────

export async function sendContributionReceiptEmail(
  email: string,
  params: ContributionReceiptEmailParams
): Promise<void> {
  const { subject, html, text } = buildContributionReceiptEmail(params);
  void sendEmail({ to: email, subject, html, text });
}

// ─── 4. Payout ────────────────────────────────────────────────────────────────

export async function sendPayoutEmail(
  email: string,
  params: PayoutEmailParams
): Promise<void> {
  const { subject, html, text } = buildPayoutEmail(params);
  void sendEmail({ to: email, subject, html, text });
}

// ─── 5. Late Payment Warning ──────────────────────────────────────────────────

export async function sendLatePaymentEmail(
  email: string,
  params: LatePaymentEmailParams
): Promise<void> {
  const { subject, html, text } = buildLatePaymentEmail(params);
  void sendEmail({ to: email, subject, html, text });
}

// ─── 6. Circle Invite ─────────────────────────────────────────────────────────

export async function sendCircleInviteEmail(
  email: string,
  params: CircleInviteEmailParams
): Promise<void> {
  const { subject, html, text } = buildCircleInviteEmail(params);
  void sendEmail({ to: email, subject, html, text });
}

// ─── 7 & 8. Dispute Raised (admin + reporter) ─────────────────────────────────

export async function sendDisputeRaisedEmails(params: {
  adminEmail: string;
  adminName: string;
  reporterEmail: string;
  reporterName: string;
  circleName: string;
  circleId: string;
  disputeType: string;
  description: string;
  disputeId: string;
  againstUserName?: string;
}): Promise<void> {
  const adminTemplate = buildDisputeAdminEmail({
    adminName: params.adminName,
    reporterName: params.reporterName,
    reporterEmail: params.reporterEmail,
    circleName: params.circleName,
    disputeType: params.disputeType,
    description: params.description,
    disputeId: params.disputeId,
    againstUserName: params.againstUserName,
  });

  const reporterTemplate = buildDisputeConfirmEmail({
    name: params.reporterName,
    circleName: params.circleName,
    disputeType: params.disputeType,
    disputeId: params.disputeId,
    circleId: params.circleId,
  });

  await Promise.allSettled([
    sendEmail({ to: params.adminEmail, ...adminTemplate }),
    sendEmail({ to: params.reporterEmail, ...reporterTemplate }),
  ]);
}

// ─── 9. Dispute Resolved ──────────────────────────────────────────────────────

export async function sendDisputeResolvedEmail(
  email: string,
  params: DisputeResolvedEmailParams
): Promise<void> {
  const { subject, html, text } = buildDisputeResolvedEmail(params);
  void sendEmail({ to: email, subject, html, text });
}