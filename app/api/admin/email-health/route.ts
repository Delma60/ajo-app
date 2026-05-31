export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { verifyEmailConnection, sendEmail } from "@/lib/services/email-service";

const SESSION_COOKIE = "__session";

async function getAdminUser(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userSnap = await adminDb
      .collection("users")
      .doc(decoded.uid)
      .get();
    if (!userSnap.exists) return null;
    const user = userSnap.data();
    if (user?.role !== "admin") return null;
    return { uid: decoded.uid, email: decoded.email ?? user?.email ?? "" };
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/email/health
 * Verifies that the Nodemailer SMTP transport can connect and authenticate.
 *
 * Returns:
 *   200 { ok: true,  config: { host, port, user, from } }
 *   503 { ok: false, error: string, config: { host, port, user, from } }
 *
 * Protected: admin role only.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return Response.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Redact password but show everything else so the admin can diagnose
  const config = {
    host: process.env.NODEMAILER_HOST ?? "(not set)",
    port: process.env.NODEMAILER_PORT ?? "(not set)",
    user: process.env.NODEMAILER_USER ?? "(not set)",
    from: process.env.NODEMAILER_FROM ?? "(not set — using default)",
    secure: process.env.NODEMAILER_PORT === "465" ? "SSL (port 465)" : "STARTTLS",
    passwordSet: !!process.env.NODEMAILER_PASS,
  };

  const result = await verifyEmailConnection();

  if (result.ok) {
    return Response.json({
      success: true,
      data: { ok: true, config },
      error: null,
    });
  }

  return Response.json(
    {
      success: false,
      data: { ok: false, config, error: result.error },
      error: result.error,
    },
    { status: 503 }
  );
}

/**
 * POST /api/admin/email/health
 * Sends a test email to the authenticated admin's email address.
 * Body: { to?: string } — defaults to the admin's own email.
 *
 * Protected: admin role only.
 */
export async function POST(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin) {
    return Response.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let to = admin.email;
  try {
    const body = await request.json();
    if (body.to && typeof body.to === "string") {
      to = body.to;
    }
  } catch {
    // Body is optional
  }

  const sent = await sendEmail({
    to,
    subject: "AjoSave — Email System Test ✅",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #047857;">Email system working correctly</h2>
        <p>This test email confirms that your Nodemailer SMTP configuration is valid and AjoSave can send transactional emails.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px 0; color: #6b7280;">SMTP Host</td>
            <td style="padding: 8px 0; font-weight: 500;">${process.env.NODEMAILER_HOST ?? "(not set)"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px 0; color: #6b7280;">SMTP Port</td>
            <td style="padding: 8px 0; font-weight: 500;">${process.env.NODEMAILER_PORT ?? "(not set)"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Sent at</td>
            <td style="padding: 8px 0; font-weight: 500;">${new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" })} (WAT)</td>
          </tr>
        </table>
        <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
          AjoSave — Community Savings Platform
        </p>
      </div>
    `,
    text: `Email system working correctly.\n\nSMTP Host: ${process.env.NODEMAILER_HOST}\nSMTP Port: ${process.env.NODEMAILER_PORT}\nSent at: ${new Date().toISOString()}`,
  });

  if (sent) {
    return Response.json({
      success: true,
      data: { sent: true, to },
      error: null,
    });
  }

  return Response.json(
    {
      success: false,
      data: { sent: false, to },
      error:
        "Email send failed. Check server logs and verify your SMTP credentials.",
    },
    { status: 503 }
  );
}