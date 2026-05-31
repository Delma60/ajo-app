/**
 * Email Templates
 *
 * One exported function per trigger event.
 * Each function returns { subject, html, text } ready for sendEmail().
 *
 * Events covered (matching README spec):
 *  1. sendWelcomeEmail          — Registration
 *  2. sendContributionReminder  — Contribution due 24h before
 *  3. sendContributionReceipt   — Contribution received
 *  4. sendPayoutEmail           — Payout received
 *  5. sendLatePaymentWarning    — Late payment warning
 *  6. sendCircleInviteEmail     — Circle invite link
 *  7. sendDisputeRaisedToAdmin  — Dispute raised → admin notification
 *  8. sendDisputeRaisedConfirm  — Dispute raised → reporter confirmation
 *  9. sendDisputeResolvedEmail  — Dispute resolved → reporter
 */

import { fmtDate, fmtNaira } from "../utils";
import { baseLayout } from "./base-layout";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ajosave.app";

// ─── Shared type ──────────────────────────────────────────────────────────────

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// ─── 1. Welcome ───────────────────────────────────────────────────────────────

export interface WelcomeEmailParams {
  name: string;
  email: string;
}

export function buildWelcomeEmail({ name }: WelcomeEmailParams): EmailTemplate {
  const subject = "Welcome to AjoSave 🎉 — Your account is ready";
  const firstName = name.split(" ")[0];

  const html = baseLayout({
    preheader: "You're now part of Nigeria's smarter savings community.",
    body: `
      <div class="email-header">
        <h1 class="email-header-title">Welcome to AjoSave, ${firstName}! 🎉</h1>
        <p class="email-header-subtitle">Your community savings journey starts now</p>
      </div>

      <div class="email-body">
        <p class="email-greeting">Hi ${firstName},</p>

        <p class="email-text">
          You've just joined thousands of Nigerians who are saving smarter together.
          AjoSave brings the trusted Ajo/Esusu tradition into a secure, transparent
          digital platform — so you can save with people you trust and receive your
          payout on time, every time.
        </p>

        <p class="email-text"><strong>Here's what to do next:</strong></p>

        <table class="info-table" style="margin: 16px 0 24px;">
          <tr>
            <td class="info-label">Step 1</td>
            <td class="info-value">Complete your profile — add your phone number</td>
          </tr>
          <tr>
            <td class="info-label">Step 2</td>
            <td class="info-value">Fund your wallet (minimum ₦500)</td>
          </tr>
          <tr>
            <td class="info-label">Step 3</td>
            <td class="info-value">Join or create your first savings circle</td>
          </tr>
        </table>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${APP_URL}/onboarding" class="btn-primary">Complete your setup</a>
        </div>

        <div class="alert-success">
          <p class="alert-success-title">💰 Referral Reward</p>
          <p class="alert-success-body">
            Invite friends and earn <strong>₦500</strong> for every friend who
            makes their first deposit of ₦1,000 or more. Find your referral link
            in your profile settings.
          </p>
        </div>

        <hr class="divider">
        <p class="email-text" style="font-size:13px; color:#9ca3af;">
          If you didn't create this account, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  const text = `Welcome to AjoSave, ${firstName}!\n\nYour account is ready. Complete your setup at: ${APP_URL}/onboarding\n\nStep 1: Add your phone number\nStep 2: Fund your wallet (min ₦500)\nStep 3: Join or create a savings circle\n\nQuestions? Reply to this email or contact support@ajosave.app`;

  return { subject, html, text };
}

// ─── 2. Contribution Due Reminder ─────────────────────────────────────────────

export interface ContributionReminderEmailParams {
  name: string;
  circleName: string;
  amountKobo: number;
  dueDate: Date;
  cycleNumber: number;
  circleId: string;
}

export function buildContributionReminderEmail({
  name,
  circleName,
  amountKobo,
  dueDate,
  cycleNumber,
  circleId,
}: ContributionReminderEmailParams): EmailTemplate {
  const subject = `⏰ Contribution due tomorrow — ${circleName}`;
  const firstName = name.split(" ")[0];

  const html = baseLayout({
    preheader: `Your ${fmtNaira(amountKobo)} contribution to ${circleName} is due soon.`,
    body: `
      <div class="email-header" style="background-color: #d97706;">
        <h1 class="email-header-title">Contribution Due Soon</h1>
        <p class="email-header-subtitle">${circleName} · Cycle ${cycleNumber}</p>
      </div>

      <div class="email-body">
        <p class="email-greeting">Hi ${firstName},</p>

        <p class="email-text">
          Your contribution for <strong>${circleName}</strong> is due in the next
          24 hours. Pay on time to keep your trust score high and avoid a late
          payment penalty.
        </p>

        <div class="amount-block" style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-color: #fde68a;">
          <p class="amount-label" style="color: #92400e;">Amount Due</p>
          <p class="amount-value" style="color: #78350f;">${fmtNaira(amountKobo)}</p>
        </div>

        <table class="info-table">
          <tr>
            <td class="info-label">Circle</td>
            <td class="info-value">${circleName}</td>
          </tr>
          <tr>
            <td class="info-label">Cycle</td>
            <td class="info-value">${cycleNumber}</td>
          </tr>
          <tr>
            <td class="info-label">Due date</td>
            <td class="info-value">${fmtDate(dueDate)}</td>
          </tr>
        </table>

        <div class="alert-warning">
          <p class="alert-warning-title">⚠️ Late payment penalty</p>
          <p class="alert-warning-body">
            If your contribution is not received within 48 hours of the due date,
            a <strong>10% late penalty</strong> (${fmtNaira(Math.round(amountKobo * 0.1))})
            will be added when you pay. Three consecutive missed payments will
            result in removal from the circle.
          </p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${APP_URL}/circles/${circleId}" class="btn-primary">Pay now</a>
        </div>

        <p class="email-text" style="font-size: 13px; color: #9ca3af; text-align: center;">
          Ensure your wallet has sufficient funds before paying.
          <a href="${APP_URL}/wallet/deposit" style="color: #047857;">Fund wallet →</a>
        </p>
      </div>
    `,
  });

  const text = `Hi ${firstName},\n\nYour contribution of ${fmtNaira(amountKobo)} to ${circleName} (Cycle ${cycleNumber}) is due by ${fmtDate(dueDate)}.\n\nPay now: ${APP_URL}/circles/${circleId}\n\nLate payments attract a 10% penalty.`;

  return { subject, html, text };
}

// ─── 3. Contribution Receipt ──────────────────────────────────────────────────

export interface ContributionReceiptEmailParams {
  name: string;
  circleName: string;
  amountKobo: number;
  penaltyKobo?: number;
  paidAt: Date;
  cycleNumber: number;
  transactionReference: string;
  circleId: string;
}

export function buildContributionReceiptEmail({
  name,
  circleName,
  amountKobo,
  penaltyKobo = 0,
  paidAt,
  cycleNumber,
  transactionReference,
  circleId,
}: ContributionReceiptEmailParams): EmailTemplate {
  const total = amountKobo + penaltyKobo;
  const subject = `✅ Contribution confirmed — ${circleName}`;
  const firstName = name.split(" ")[0];

  const html = baseLayout({
    preheader: `Your ${fmtNaira(amountKobo)} contribution to ${circleName} has been recorded.`,
    body: `
      <div class="email-header">
        <h1 class="email-header-title">Contribution Confirmed ✅</h1>
        <p class="email-header-subtitle">${circleName} · Cycle ${cycleNumber}</p>
      </div>

      <div class="email-body">
        <p class="email-greeting">Hi ${firstName},</p>

        <p class="email-text">
          Your contribution to <strong>${circleName}</strong> has been received
          and recorded successfully. Keep it up!
        </p>

        <div class="amount-block">
          <p class="amount-label">Amount Paid</p>
          <p class="amount-value">${fmtNaira(amountKobo)}</p>
        </div>

        <table class="info-table">
          <tr>
            <td class="info-label">Circle</td>
            <td class="info-value">${circleName}</td>
          </tr>
          <tr>
            <td class="info-label">Cycle</td>
            <td class="info-value">${cycleNumber}</td>
          </tr>
          <tr>
            <td class="info-label">Paid on</td>
            <td class="info-value">${fmtDate(paidAt)}</td>
          </tr>
          ${penaltyKobo > 0 ? `
          <tr>
            <td class="info-label">Late penalty</td>
            <td class="info-value" style="color:#b91c1c;">${fmtNaira(penaltyKobo)}</td>
          </tr>
          <tr>
            <td class="info-label"><strong>Total deducted</strong></td>
            <td class="info-value mono"><strong>${fmtNaira(total)}</strong></td>
          </tr>
          ` : ""}
          <tr>
            <td class="info-label">Reference</td>
            <td class="info-value mono" style="font-size:12px;">${transactionReference}</td>
          </tr>
        </table>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${APP_URL}/circles/${circleId}" class="btn-outline">View circle</a>
        </div>
      </div>
    `,
  });

  const text = `Hi ${firstName},\n\nYour ${fmtNaira(amountKobo)} contribution to ${circleName} (Cycle ${cycleNumber}) was confirmed on ${fmtDate(paidAt)}.\n\nReference: ${transactionReference}\n\nView circle: ${APP_URL}/circles/${circleId}`;

  return { subject, html, text };
}

// ─── 4. Payout Received ───────────────────────────────────────────────────────

export interface PayoutEmailParams {
  name: string;
  circleName: string;
  grossPayoutKobo: number;
  platformFeeKobo: number;
  netPayoutKobo: number;
  cycleNumber: number;
  circleId: string;
  payoutDate: Date;
  transactionReference: string;
}

export function buildPayoutEmail({
  name,
  circleName,
  grossPayoutKobo,
  platformFeeKobo,
  netPayoutKobo,
  cycleNumber,
  circleId,
  payoutDate,
  transactionReference,
}: PayoutEmailParams): EmailTemplate {
  const subject = `🎉 You received a payout of ${fmtNaira(netPayoutKobo)} from ${circleName}!`;
  const firstName = name.split(" ")[0];

  const html = baseLayout({
    preheader: `${fmtNaira(netPayoutKobo)} has been credited to your AjoSave wallet.`,
    body: `
      <div class="email-header" style="background: linear-gradient(135deg, #047857 0%, #065f46 100%);">
        <h1 class="email-header-title">Payout Received! 🎉</h1>
        <p class="email-header-subtitle">The savings circle paid out — congratulations!</p>
      </div>

      <div class="email-body">
        <p class="email-greeting">Congratulations, ${firstName}!</p>

        <p class="email-text">
          It's your turn! Your payout from <strong>${circleName}</strong> has been
          processed and credited to your AjoSave wallet. You can withdraw to your
          bank account from the wallet page.
        </p>

        <div class="amount-block">
          <p class="amount-label">Net Payout Received</p>
          <p class="amount-value">${fmtNaira(netPayoutKobo)}</p>
        </div>

        <table class="info-table">
          <tr>
            <td class="info-label">Circle</td>
            <td class="info-value">${circleName}</td>
          </tr>
          <tr>
            <td class="info-label">Cycle</td>
            <td class="info-value">${cycleNumber}</td>
          </tr>
          <tr>
            <td class="info-label">Gross payout</td>
            <td class="info-value mono">${fmtNaira(grossPayoutKobo)}</td>
          </tr>
          <tr>
            <td class="info-label">Platform fee (1%)</td>
            <td class="info-value mono" style="color:#6b7280;">− ${fmtNaira(platformFeeKobo)}</td>
          </tr>
          <tr>
            <td class="info-label"><strong>You received</strong></td>
            <td class="info-value mono" style="color:#047857;"><strong>${fmtNaira(netPayoutKobo)}</strong></td>
          </tr>
          <tr>
            <td class="info-label">Date</td>
            <td class="info-value">${fmtDate(payoutDate)}</td>
          </tr>
          <tr>
            <td class="info-label">Reference</td>
            <td class="info-value mono" style="font-size:12px;">${transactionReference}</td>
          </tr>
        </table>

        <div style="text-align: center; margin: 28px 0; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <a href="${APP_URL}/wallet" class="btn-primary">Go to wallet</a>
          <a href="${APP_URL}/wallet/withdraw" class="btn-outline">Withdraw to bank</a>
        </div>

        <div class="alert-success">
          <p class="alert-success-title">Keep the savings going!</p>
          <p class="alert-success-body">
            Remember to continue your contributions for the remaining cycles so
            your fellow members can also receive their payouts on time.
          </p>
        </div>
      </div>
    `,
  });

  const text = `Congratulations ${firstName}!\n\nYou received ${fmtNaira(netPayoutKobo)} payout from ${circleName} (Cycle ${cycleNumber}) on ${fmtDate(payoutDate)}.\n\nGross: ${fmtNaira(grossPayoutKobo)} | Fee: ${fmtNaira(platformFeeKobo)} | Net: ${fmtNaira(netPayoutKobo)}\nReference: ${transactionReference}\n\nWithdraw: ${APP_URL}/wallet/withdraw`;

  return { subject, html, text };
}

// ─── 5. Late Payment Warning ──────────────────────────────────────────────────

export interface LatePaymentEmailParams {
  name: string;
  circleName: string;
  contributionKobo: number;
  penaltyKobo: number;
  circleId: string;
  originalDueDate: Date;
}

export function buildLatePaymentEmail({
  name,
  circleName,
  contributionKobo,
  penaltyKobo,
  circleId,
  originalDueDate,
}: LatePaymentEmailParams): EmailTemplate {
  const subject = `⚠️ Overdue: Your contribution to ${circleName} is late`;
  const firstName = name.split(" ")[0];
  const totalOwed = contributionKobo + penaltyKobo;

  const html = baseLayout({
    preheader: `Your ${fmtNaira(contributionKobo)} contribution is overdue. Pay now to avoid further penalties.`,
    body: `
      <div class="email-header" style="background-color: #c2410c;">
        <h1 class="email-header-title">Contribution Overdue ⚠️</h1>
        <p class="email-header-subtitle">${circleName}</p>
      </div>

      <div class="email-body">
        <p class="email-greeting">Hi ${firstName},</p>

        <p class="email-text">
          Your contribution to <strong>${circleName}</strong> is now overdue.
          A late payment penalty has been applied to your account. Please pay
          as soon as possible to avoid missing another cycle.
        </p>

        <div class="amount-block" style="background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%); border-color: #fecdd3;">
          <p class="amount-label" style="color: #9f1239;">Total Now Owed</p>
          <p class="amount-value" style="color: #7f1d1d;">${fmtNaira(totalOwed)}</p>
        </div>

        <table class="info-table">
          <tr>
            <td class="info-label">Original contribution</td>
            <td class="info-value mono">${fmtNaira(contributionKobo)}</td>
          </tr>
          <tr>
            <td class="info-label">Late penalty (10%)</td>
            <td class="info-value mono" style="color:#b91c1c;">${fmtNaira(penaltyKobo)}</td>
          </tr>
          <tr>
            <td class="info-label"><strong>Total to pay</strong></td>
            <td class="info-value mono"><strong>${fmtNaira(totalOwed)}</strong></td>
          </tr>
          <tr>
            <td class="info-label">Original due date</td>
            <td class="info-value">${fmtDate(originalDueDate)}</td>
          </tr>
        </table>

        <div class="alert-danger">
          <p class="alert-danger-title">⛔ Risk of Removal</p>
          <p class="alert-danger-body">
            Three consecutive missed payments will result in automatic removal
            from the circle and a negative impact on your trust score.
          </p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${APP_URL}/circles/${circleId}" class="btn-primary" style="background-color: #b91c1c;">
            Pay ${fmtNaira(totalOwed)} now
          </a>
        </div>

        <p class="email-text" style="font-size: 13px; color: #9ca3af; text-align: center;">
          Need to fund your wallet first?
          <a href="${APP_URL}/wallet/deposit" style="color: #047857;">Add funds →</a>
        </p>
      </div>
    `,
  });

  const text = `Hi ${firstName},\n\nYour contribution to ${circleName} is overdue.\nTotal now owed: ${fmtNaira(totalOwed)} (contribution ${fmtNaira(contributionKobo)} + penalty ${fmtNaira(penaltyKobo)})\n\nPay now to avoid removal: ${APP_URL}/circles/${circleId}`;

  return { subject, html, text };
}

// ─── 6. Circle Invite ─────────────────────────────────────────────────────────

export interface CircleInviteEmailParams {
  recipientName: string;
  senderName: string;
  circleName: string;
  circleDescription: string;
  contributionKobo: number;
  frequency: string;
  maxMembers: number;
  inviteToken: string;
  circleId: string;
  expiresAt: Date;
}

export function buildCircleInviteEmail({
  recipientName,
  senderName,
  circleName,
  circleDescription,
  contributionKobo,
  frequency,
  maxMembers,
  inviteToken,
  circleId,
  expiresAt,
}: CircleInviteEmailParams): EmailTemplate {
  const subject = `${senderName} invited you to join "${circleName}" on AjoSave`;
  const firstName = recipientName.split(" ")[0];
  const inviteUrl = `${APP_URL}/circles/${circleId}?invite=${inviteToken}`;

  const freqLabel: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    "bi-weekly": "Bi-weekly",
    monthly: "Monthly",
  };

  const html = baseLayout({
    preheader: `${senderName} wants you to join their savings circle on AjoSave.`,
    body: `
      <div class="email-header" style="background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);">
        <h1 class="email-header-title">You're Invited! 👋</h1>
        <p class="email-header-subtitle">${senderName} wants you to join their circle</p>
      </div>

      <div class="email-body">
        <p class="email-greeting">Hi ${firstName},</p>

        <p class="email-text">
          <strong>${senderName}</strong> has invited you to join their savings circle
          on AjoSave — the platform that makes Ajo/Esusu safe, transparent, and reliable.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 24px; margin: 20px 0;">
          <p style="font-size: 17px; font-weight: 700; color: #1e293b; margin: 0 0 6px;">${circleName}</p>
          <p style="font-size: 14px; color: #64748b; margin: 0 0 16px; line-height: 1.5;">${circleDescription}</p>

          <table class="info-table" style="margin: 0;">
            <tr>
              <td class="info-label">Contribution</td>
              <td class="info-value mono">${fmtNaira(contributionKobo)} / ${freqLabel[frequency] ?? frequency}</td>
            </tr>
            <tr>
              <td class="info-label">Members</td>
              <td class="info-value">Up to ${maxMembers} people</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${inviteUrl}" class="btn-primary" style="background-color: #1d4ed8;">
            Accept invitation
          </a>
        </div>

        <p class="email-text" style="font-size: 13px; color: #9ca3af; text-align: center;">
          This invitation expires on <strong>${fmtDate(expiresAt)}</strong>.
          You must have an AjoSave account to join.
        </p>

        <hr class="divider">
        <p class="email-text" style="font-size: 13px; color: #9ca3af;">
          Not interested? You can safely ignore this email. The invite will expire automatically.
        </p>
      </div>
    `,
  });

  const text = `Hi ${firstName},\n\n${senderName} invited you to join "${circleName}" on AjoSave.\nContribution: ${fmtNaira(contributionKobo)} / ${freqLabel[frequency] ?? frequency} | ${maxMembers} members\n\nAccept: ${inviteUrl}\n\nExpires: ${fmtDate(expiresAt)}`;

  return { subject, html, text };
}

// ─── 7. Dispute Raised → Admin ────────────────────────────────────────────────

export interface DisputeAdminEmailParams {
  adminName: string;
  reporterName: string;
  reporterEmail: string;
  circleName: string;
  disputeType: string;
  description: string;
  disputeId: string;
  againstUserName?: string;
}

export function buildDisputeAdminEmail({
  adminName,
  reporterName,
  reporterEmail,
  circleName,
  disputeType,
  description,
  disputeId,
  againstUserName,
}: DisputeAdminEmailParams): EmailTemplate {
  const subject = `[Admin] New dispute raised — ${circleName}`;
  const firstName = adminName.split(" ")[0];

  const typeLabels: Record<string, string> = {
    missed_payout: "Missed Payout",
    admin_abuse: "Admin Abuse",
    fraudulent_member: "Fraudulent Member",
    other: "Other",
  };

  const html = baseLayout({
    preheader: `${reporterName} raised a dispute for circle "${circleName}". Review required.`,
    body: `
      <div class="email-header" style="background-color: #7c3aed;">
        <h1 class="email-header-title">New Dispute Raised</h1>
        <p class="email-header-subtitle">Admin action required · ${circleName}</p>
      </div>

      <div class="email-body">
        <p class="email-greeting">Hi ${firstName},</p>

        <p class="email-text">
          A new dispute has been raised on the AjoSave platform and requires
          your review. Please investigate and update the dispute status in the
          admin dashboard.
        </p>

        <table class="info-table">
          <tr>
            <td class="info-label">Circle</td>
            <td class="info-value">${circleName}</td>
          </tr>
          <tr>
            <td class="info-label">Type</td>
            <td class="info-value">${typeLabels[disputeType] ?? disputeType}</td>
          </tr>
          <tr>
            <td class="info-label">Raised by</td>
            <td class="info-value">${reporterName}</td>
          </tr>
          <tr>
            <td class="info-label">Reporter email</td>
            <td class="info-value">${reporterEmail}</td>
          </tr>
          ${againstUserName ? `
          <tr>
            <td class="info-label">Against</td>
            <td class="info-value">${againstUserName}</td>
          </tr>
          ` : ""}
          <tr>
            <td class="info-label">Dispute ID</td>
            <td class="info-value mono" style="font-size:12px;">${disputeId}</td>
          </tr>
        </table>

        <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 16px 20px; margin: 16px 0;">
          <p style="font-size: 12px; font-weight: 600; color: #7c3aed; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.5px;">Description</p>
          <p style="font-size: 14px; color: #374151; margin: 0; line-height: 1.6; white-space: pre-wrap;">${description}</p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${APP_URL}/admin/disputes" class="btn-primary" style="background-color: #7c3aed;">
            Review in admin dashboard
          </a>
        </div>
      </div>
    `,
  });

  const text = `New dispute raised.\n\nCircle: ${circleName}\nType: ${typeLabels[disputeType] ?? disputeType}\nRaised by: ${reporterName} (${reporterEmail})\nID: ${disputeId}\n\nDescription:\n${description}\n\nReview: ${APP_URL}/admin/disputes`;

  return { subject, html, text };
}

// ─── 8. Dispute Raised → Reporter Confirmation ────────────────────────────────

export interface DisputeConfirmEmailParams {
  name: string;
  circleName: string;
  disputeType: string;
  disputeId: string;
  circleId: string;
}

export function buildDisputeConfirmEmail({
  name,
  circleName,
  disputeType,
  disputeId,
  circleId,
}: DisputeConfirmEmailParams): EmailTemplate {
  const subject = `Dispute submitted — we're on it`;
  const firstName = name.split(" ")[0];

  const html = baseLayout({
    preheader: "Your dispute has been received. Our team will review it shortly.",
    body: `
      <div class="email-header" style="background-color: #0f172a;">
        <h1 class="email-header-title">Dispute Received</h1>
        <p class="email-header-subtitle">We're reviewing your report for ${circleName}</p>
      </div>

      <div class="email-body">
        <p class="email-greeting">Hi ${firstName},</p>

        <p class="email-text">
          Your dispute has been received and is now in our review queue. Our
          support team typically responds within 24–48 hours. We'll notify you
          by email when there's an update.
        </p>

        <table class="info-table">
          <tr>
            <td class="info-label">Circle</td>
            <td class="info-value">${circleName}</td>
          </tr>
          <tr>
            <td class="info-label">Dispute type</td>
            <td class="info-value">${disputeType.replace(/_/g, " ")}</td>
          </tr>
          <tr>
            <td class="info-label">Reference ID</td>
            <td class="info-value mono" style="font-size:12px;">${disputeId}</td>
          </tr>
        </table>

        <p class="email-text">
          While we investigate, we recommend continuing your regular contributions
          to avoid any impact on your trust score.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${APP_URL}/circles/${circleId}" class="btn-outline">
            View circle
          </a>
        </div>

        <hr class="divider">
        <p class="email-text" style="font-size: 13px; color: #9ca3af;">
          Need to add more details? Reply to this email with your dispute ID
          <strong>${disputeId}</strong> and we'll attach it to your case.
        </p>
      </div>
    `,
  });

  const text = `Hi ${firstName},\n\nYour dispute for "${circleName}" has been received.\nReference: ${disputeId}\n\nWe'll review within 24–48 hours and notify you by email.\n\nView circle: ${APP_URL}/circles/${circleId}`;

  return { subject, html, text };
}

// ─── 9. Dispute Resolved → Reporter ──────────────────────────────────────────

export interface DisputeResolvedEmailParams {
  name: string;
  circleName: string;
  outcome: "resolved" | "dismissed";
  resolution?: string;
  disputeId: string;
  circleId: string;
}

export function buildDisputeResolvedEmail({
  name,
  circleName,
  outcome,
  resolution,
  disputeId,
  circleId,
}: DisputeResolvedEmailParams): EmailTemplate {
  const outcomeLabel = outcome === "resolved" ? "Resolved" : "Dismissed";
  const subject = `Your dispute has been ${outcomeLabel.toLowerCase()} — ${circleName}`;
  const firstName = name.split(" ")[0];

  const isResolved = outcome === "resolved";
  const headerBg = isResolved ? "#047857" : "#6b7280";
  const alertType = isResolved ? "alert-success" : "alert-warning";
  const alertTitleClass = isResolved ? "alert-success-title" : "alert-warning-title";
  const alertBodyClass = isResolved ? "alert-success-body" : "alert-warning-body";

  const html = baseLayout({
    preheader: `Your dispute for "${circleName}" has been ${outcomeLabel.toLowerCase()}.`,
    body: `
      <div class="email-header" style="background-color: ${headerBg};">
        <h1 class="email-header-title">Dispute ${outcomeLabel}</h1>
        <p class="email-header-subtitle">${circleName}</p>
      </div>

      <div class="email-body">
        <p class="email-greeting">Hi ${firstName},</p>

        <p class="email-text">
          Our team has completed the review of your dispute for
          <strong>${circleName}</strong>. Here's the outcome:
        </p>

        <table class="info-table">
          <tr>
            <td class="info-label">Outcome</td>
            <td class="info-value" style="color: ${isResolved ? "#047857" : "#6b7280"}; font-weight: 600;">
              ${outcomeLabel}
            </td>
          </tr>
          <tr>
            <td class="info-label">Reference ID</td>
            <td class="info-value mono" style="font-size:12px;">${disputeId}</td>
          </tr>
        </table>

        ${resolution ? `
        <div class="${alertType}" style="margin: 20px 0;">
          <p class="${alertTitleClass}">Admin Resolution Notes</p>
          <p class="${alertBodyClass}" style="white-space: pre-wrap;">${resolution}</p>
        </div>
        ` : ""}

        <p class="email-text">
          ${isResolved
            ? "We're glad we could help resolve this matter. If you have any further concerns, don't hesitate to reach out."
            : "If you believe this decision was made in error or have additional information, please contact our support team directly."}
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${APP_URL}/circles/${circleId}" class="btn-primary">
            Return to circle
          </a>
        </div>

        <hr class="divider">
        <p class="email-text" style="font-size: 13px; color: #9ca3af;">
          Questions? Email us at
          <a href="mailto:support@ajosave.app" style="color: #047857;">support@ajosave.app</a>
          and reference your dispute ID <strong>${disputeId}</strong>.
        </p>
      </div>
    `,
  });

  const text = `Hi ${firstName},\n\nYour dispute for "${circleName}" has been ${outcomeLabel}.\nReference: ${disputeId}\n${resolution ? `\nResolution: ${resolution}\n` : ""}\nReturn to circle: ${APP_URL}/circles/${circleId}`;

  return { subject, html, text };
}