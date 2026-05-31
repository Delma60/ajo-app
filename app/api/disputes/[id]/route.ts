import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// PATCH /api/disputes/[id]
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await request.json();
    const { action, summary, status, fileBase64, fileName } = body;
    const disputeRef = adminDb.collection("disputes").doc(id);
    const disputeSnap = await disputeRef.get();
    if (!disputeSnap.exists) {
      return new Response(JSON.stringify({ success: false, error: "Dispute not found" }), { status: 404 });
    }

    const updates: any = { updatedAt: Timestamp.now() };
    if (summary) updates.resolution = summary;
    if (status) updates.status = status;
    if (action === "escalate") updates.status = "under_review";

    // Handle document upload (optional)
    let fileUrl = null;
    if (fileBase64 && fileName) {
      const buffer = Buffer.from(fileBase64, "base64");
      const bucket = adminStorage.bucket();
      const file = bucket.file(`disputes/${id}/${fileName}`);
      await file.save(buffer, { contentType: "application/octet-stream" });
      fileUrl = `https://storage.googleapis.com/${bucket.name}/disputes/${id}/${fileName}`;
      updates.fileUrl = fileUrl;
    }

    await disputeRef.update(updates);
    return new Response(JSON.stringify({ success: true, data: { id, ...updates, fileUrl } }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}
