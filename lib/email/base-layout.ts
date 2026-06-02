/**
 * Base HTML layout for all AjoSave transactional emails.
 * Renders a consistent header, footer, and body wrapper.
 * Individual email templates call this with their own inner HTML content.
 */

export interface BaseLayoutProps {
  preheader?: string;
  body: string;
  year?: number;
  siteName?: string;
  supportEmail?: string;
  appUrl?: string;
}

export function baseLayout({
  preheader = "",
  body,
  year = new Date().getFullYear(),
  siteName = "AjoSave",
  supportEmail = "support@ajosave.app",
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ajosave.app",
}: BaseLayoutProps): string {
  const brandName = siteName || "AjoSave";
  const supportAddress = supportEmail || "support@ajosave.app";
  const baseUrl = appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl;

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>AjoSave</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    *, *::before, *::after { box-sizing: border-box; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0; mso-table-rspace: 0; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }

    /* Base */
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f3;
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      color: #1a1a1a;
      -webkit-font-smoothing: antialiased;
    }

    /* Wrapper */
    .email-wrapper {
      width: 100%;
      background-color: #f4f6f3;
      padding: 40px 16px;
    }

    /* Container */
    .email-container {
      max-width: 580px;
      margin: 0 auto;
    }

    /* Logo area */
    .email-logo {
      text-align: center;
      padding-bottom: 28px;
    }
    .email-logo-mark {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
    }
    .email-logo-icon {
      display: inline-block;
      width: 36px;
      height: 36px;
      background-color: #047857;
      border-radius: 10px;
      text-align: center;
      line-height: 36px;
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      font-family: 'Playfair Display', Georgia, serif;
    }
    .email-logo-text {
      font-size: 20px;
      font-weight: 600;
      color: #047857;
      letter-spacing: -0.3px;
    }

    /* Card */
    .email-card {
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    /* Header stripe */
    .email-header {
      background-color: #047857;
      padding: 28px 36px 24px;
    }
    .email-header-title {
      margin: 0;
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px;
      font-weight: 600;
      color: #ffffff;
      line-height: 1.3;
    }
    .email-header-subtitle {
      margin: 6px 0 0;
      font-size: 14px;
      color: rgba(255,255,255,0.75);
    }

    /* Body */
    .email-body {
      padding: 32px 36px;
    }

    /* Greeting */
    .email-greeting {
      font-size: 15px;
      color: #374151;
      margin: 0 0 20px;
      line-height: 1.6;
    }

    /* Amount block */
    .amount-block {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      padding: 20px 24px;
      margin: 24px 0;
      text-align: center;
    }
    .amount-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #047857;
      margin: 0 0 6px;
    }
    .amount-value {
      font-size: 32px;
      font-weight: 700;
      color: #064e3b;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      margin: 0;
      letter-spacing: -1px;
    }

    /* Info table */
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .info-table tr {
      border-bottom: 1px solid #f3f4f6;
    }
    .info-table tr:last-child {
      border-bottom: none;
    }
    .info-table td {
      padding: 10px 0;
      font-size: 14px;
    }
    .info-table .info-label {
      color: #6b7280;
      width: 45%;
    }
    .info-table .info-value {
      color: #111827;
      font-weight: 500;
      text-align: right;
    }
    .info-table .info-value.mono {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
    }

    /* CTA button */
    .btn-primary {
      display: inline-block;
      background-color: #047857;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      padding: 14px 28px;
      border-radius: 10px;
      letter-spacing: -0.1px;
    }
    .btn-outline {
      display: inline-block;
      background-color: transparent;
      color: #047857 !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 24px;
      border-radius: 10px;
      border: 2px solid #047857;
    }

    /* Alert boxes */
    .alert-warning {
      background-color: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 10px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .alert-warning-title {
      font-size: 13px;
      font-weight: 600;
      color: #92400e;
      margin: 0 0 4px;
    }
    .alert-warning-body {
      font-size: 13px;
      color: #b45309;
      margin: 0;
      line-height: 1.5;
    }
    .alert-danger {
      background-color: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 10px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .alert-danger-title {
      font-size: 13px;
      font-weight: 600;
      color: #9f1239;
      margin: 0 0 4px;
    }
    .alert-danger-body {
      font-size: 13px;
      color: #be123c;
      margin: 0;
      line-height: 1.5;
    }
    .alert-success {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 10px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .alert-success-title {
      font-size: 13px;
      font-weight: 600;
      color: #14532d;
      margin: 0 0 4px;
    }
    .alert-success-body {
      font-size: 13px;
      color: #166534;
      margin: 0;
      line-height: 1.5;
    }

    /* Divider */
    .divider {
      border: none;
      border-top: 1px solid #f3f4f6;
      margin: 24px 0;
    }

    /* Body text */
    .email-text {
      font-size: 15px;
      color: #4b5563;
      line-height: 1.7;
      margin: 0 0 16px;
    }
    .email-text:last-child { margin-bottom: 0; }

    /* Footer */
    .email-footer {
      padding: 24px 36px;
      background-color: #f9fafb;
      border-top: 1px solid #f3f4f6;
    }
    .email-footer-text {
      font-size: 12px;
      color: #9ca3af;
      line-height: 1.6;
      margin: 0;
      text-align: center;
    }
    .email-footer-link {
      color: #6b7280;
      text-decoration: underline;
    }

    /* Mobile */
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 20px 12px; }
      .email-header { padding: 22px 20px 18px; }
      .email-body { padding: 24px 20px; }
      .email-footer { padding: 20px; }
      .amount-value { font-size: 26px; }
      .email-header-title { font-size: 19px; }
    }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}

  <div class="email-wrapper">
    <div class="email-container">

      <!-- Logo -->
      <div class="email-logo">
        <a href="${baseUrl}" class="email-logo-mark">
          <span class="email-logo-icon">${brandName.charAt(0) || "A"}</span>
          <span class="email-logo-text">${brandName}</span>
        </a>
      </div>

      <!-- Card -->
      <div class="email-card">
        ${body}

        <!-- Footer -->
        <div class="email-footer">
          <p class="email-footer-text">
            © ${year} ${brandName}. Community savings, reimagined.<br>
            Questions? <a href="mailto:${supportAddress}" class="email-footer-link">${supportAddress}</a>
            &nbsp;·&nbsp;
            <a href="${baseUrl}/settings?tab=notifications" class="email-footer-link">Manage email preferences</a>
          </p>
        </div>
      </div>

    </div>
  </div>
</body>
</html>`;
}