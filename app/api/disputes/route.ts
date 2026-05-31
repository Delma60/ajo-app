import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// POST /api/disputes/
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transactionHash, reason, raisedBy } = body;
    if (!transactionHash || !reason || !raisedBy) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), { status: 400 });
    }

    // Find the transaction by hash
    const txSnap = await adminDb.collection("transactions").where("reference", "==", transactionHash).limit(1).get();
    if (txSnap.empty) {
      return new Response(JSON.stringify({ success: false, error: "Transaction not found" }), { status: 404 });
    }
    const txDoc = txSnap.docs[0];
    const tx = txDoc.data();

    // Create dispute log
    const disputeRef = adminDb.collection("disputes").doc();
    const dispute = {
      id: disputeRef.id,
      circleId: tx.circleId || null,
      raisedBy,
      againstUserId: tx.userId,
      type: "other",
      description: reason,
      status: "open",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await disputeRef.set(dispute);

    // Freeze transaction (set status to 'pending' if not already)
    await txDoc.ref.update({ status: "pending", disputeId: disputeRef.id });

    return new Response(JSON.stringify({ success: true, data: dispute }), { status: 201 });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}
