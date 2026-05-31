// app/api/auth/welcome/route.ts
import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email/senders";

export async function POST(request: Request) {
  try {
    const { name, email } = await request.json();
    
    if (!email || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Call your backend sender safely on the server
    await sendWelcomeEmail({ name, email });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}