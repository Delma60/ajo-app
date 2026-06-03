import { NextResponse } from "next/server";

export async function GET() {
  return new Response("Google auth is temporarily disabled.", { status: 404 });
}
