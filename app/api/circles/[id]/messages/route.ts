import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/firebase/server-auth";
import { FieldValue } from "firebase-admin/firestore";

const messageSchema = z.object({
  text: z.string().min(1, "Message cannot be empty").max(2000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = messageSchema.safeParse(await request.json());
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error.message }, { status: 400 });
  }

  const { id: circleId } = await params;
  const circleDoc = await adminDb.collection("circles").doc(circleId).get();
  if (!circleDoc.exists) {
    return NextResponse.json({ success: false, error: "Circle not found" }, { status: 404 });
  }

  const circleData = circleDoc.data();
  if (!circleData?.memberIds?.includes(currentUser.uid)) {
    return NextResponse.json({ success: false, error: "Only circle members can post messages" }, { status: 403 });
  }

  const userDoc = await adminDb.collection("users").doc(currentUser.uid).get();
  const userData = userDoc.data();

  const newMessageRef = adminDb.collection("circle_messages").doc();
  await newMessageRef.set({
    id: newMessageRef.id,
    circleId,
    userId: currentUser.uid,
    senderName: userData?.name || "Member",
    senderAvatarUrl: userData?.avatarUrl || null,
    text: result.data.text.trim(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, data: { id: newMessageRef.id } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getSessionUser(request);
  if (!currentUser) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: circleId } = await params;
  const circleDoc = await adminDb.collection("circles").doc(circleId).get();
  if (!circleDoc.exists) {
    return NextResponse.json({ success: false, error: "Circle not found" }, { status: 404 });
  }

  const circleData = circleDoc.data();
  if (!circleData?.memberIds?.includes(currentUser.uid)) {
    return NextResponse.json({ success: false, error: "Only circle members can view messages" }, { status: 403 });
  }

  const messagesSnapshot = await adminDb
    .collection("circle_messages")
    .where("circleId", "==", circleId)
    .orderBy("createdAt", "asc")
    .limit(200)
    .get();

  const messages = messagesSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ success: true, data: messages });
}
