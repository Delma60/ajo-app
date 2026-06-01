import { baseLayout } from "@/lib/email/base-layout";
import type { EmailSettingsContext, EmailTemplate } from "@/lib/email/templates";

export interface SupportTicketConfirmationEmailParams {
  name: string;
  subject: string;
  ticketId: string;
  category: string;
  priority: string;
}

export function buildSupportTicketConfirmationEmail(
  { name, subject, ticketId, category, priority }: SupportTicketConfirmationEmailParams,
  context: EmailSettingsContext = { appUrl: "", supportEmail: "support@ajosave.app" }
): EmailTemplate {
  const { appUrl, supportEmail } = context;
  const firstName = name.split(" ")[0];

  const html = baseLayout({
    preheader: `Your support ticket has been created. We will respond soon.`,
    body: `
      <div class="email-header" style="background-color: #047857;">
        <h1 class="email-header-title">Support request received</h1>
        <p class="email-header-subtitle">Ticket #${ticketId}</p>
      </div>

      <div class="email-body">
        <p class="email-greeting">Hi ${firstName},</p>

        <p class="email-text">
          Thanks for contacting AjoSave support. We have received your ticket and assigned it a reference number.
        </p>

        <table class="info-table">
          <tr>
            <td class="info-label">Subject</td>
            <td class="info-value">${subject}</td>
          </tr>
          <tr>
            <td class="info-label">Category</td>
            <td class="info-value">${category}</td>
          </tr>
          <tr>
            <td class="info-label">Priority</td>
            <td class="info-value">${priority}</td>
          </tr>
          <tr>
            <td class="info-label">Ticket ID</td>
            <td class="info-value mono" style="font-size:12px;">${ticketId}</td>
          </tr>
        </table>

        <p class="email-text">
          A member of our support team will review your case and get back to you shortly. You can follow the progress of your ticket in the AjoSave app.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${appUrl}/support/${ticketId}" class="btn-primary">
            View ticket
          </a>
        </div>

        <hr class="divider">
        <p class="email-text" style="font-size: 13px; color: #9ca3af;">
          If you have new information, reply to this email or visit
          <a href="${appUrl}/support/${ticketId}" style="color: #047857;">your support ticket</a>.
        </p>
        <p class="email-text" style="font-size: 13px; color: #9ca3af;">
          Need immediate help? Email <a href="mailto:${supportEmail}" style="color: #047857;">${supportEmail}</a>.
        </p>
      </div>
    `,
  });

  const text = `Hi ${firstName},\n\nThanks for contacting AjoSave support. Your ticket has been received.\n\nSubject: ${subject}\nCategory: ${category}\nPriority: ${priority}\nTicket ID: ${ticketId}\n\nWe will get back to you shortly.\n\nTrack your ticket: ${appUrl}/support/${ticketId}`;

  return { subject: `Support request received — ${subject}`, html, text };
}
