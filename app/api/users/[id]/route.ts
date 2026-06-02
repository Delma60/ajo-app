import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/firebase/server-auth";
import { userProfileSchema } from "@/lib/validators/user";
import { serverTimestamp } from "firebase-admin/firestore";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (sessionUser.uid !== id && sessionUser.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const userSnap = await adminDb.collection("users").doc(id).get();
  if (!userSnap.exists) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { id: userSnap.id, ...(userSnap.data() as any) }, error: null });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (sessionUser.uid !== id && sessionUser.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ success: false, error: "Malformed JSON body" }, { status: 400 });
  }

  const parsed = userProfileSchema.safeParse(body);
  if (!parsed.success) {
    const errorMessage = parsed.error.issues?.[0]?.message ?? "Invalid user data";
    return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
  }

  await adminDb.collection("users").doc(id).update({
    name: parsed.data.name,
    phone: parsed.data.phone,
    updatedAt: serverTimestamp(),
  });

  return NextResponse.json({ success: true, data: null, error: null });
}
