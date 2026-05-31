// app/api/disputes/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { DisputeService } from "@/lib/services/dispute-service";
import type { Dispute } from "@/lib/types/dispute";

export async function POST(request: Request) {
  try {
    // 1. Verify Session & Authenticate
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decodedToken.uid; // Securely derived active user ID

    // 2. Parse Request Payload
    const body = await request.json();
    const { transactionHash, reason, type = "other", circleId, againstUserId } = body;

    const disputeService = new DisputeService();
    let dispute;

    // 3. Delegate to DisputeService
    // We maintain support for creating disputes via a transaction hash (legacy approach)
    // while additionally supporting direct dispute creation using a circleId.
    if (transactionHash) {
      const txSnap = await adminDb
        .collection("transactions")
        .where("reference", "==", transactionHash)
        .limit(1)
        .get();

      if (txSnap.empty) {
        return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
      }
      
      const txDoc = txSnap.docs[0];
      const tx = txDoc.data();

      // Ensure the transaction resolves to a circle
      if (!tx.circleId) {
         return NextResponse.json({ success: false, error: "Transaction does not belong to a circle" }, { status: 400 });
      }

      dispute = await disputeService.raiseDispute({
        circleId: tx.circleId,
        raisedBy: uid, // Use auth session UID instead of body.raisedBy
        type: type as Dispute["type"],
        description: reason,
        againstUserId: tx.userId,
      });

      // Freeze the transaction alongside dispute creation
      await txDoc.ref.update({ status: "pending", disputeId: dispute.id });
      
    } else {
      // Generic dispute creation
      if (!circleId || !reason) {
        return NextResponse.json({ success: false, error: "Missing required fields: transactionHash or circleId" }, { status: 400 });
      }

      dispute = await disputeService.raiseDispute({
        circleId,
        raisedBy: uid,
        type: type as Dispute["type"],
        description: reason,
        againstUserId,
      });
    }

    return NextResponse.json({ success: true, data: dispute }, { status: 201 });
    
  } catch (error: any) {
    console.error("[api/disputes/POST] Error:", error);
    
    // Format custom service errors correctly to the client
    if (error.name === "DisputeError") {
      const statusCode = 
        error.code === "UNAUTHORIZED" ? 403 :
        error.code === "NOT_FOUND" ? 404 : 400;
        
      return NextResponse.json({ success: false, error: error.message }, { status: statusCode });
    }

    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}