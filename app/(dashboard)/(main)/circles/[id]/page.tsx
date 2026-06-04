import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { CircleDetailContent } from "@/components/circles/details-content";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const circleDoc = await adminDb.collection("circles").doc(id).get();
    if (!circleDoc.exists) return { title: "Circle not found" };
    const name = circleDoc.data()?.name ?? "Circle";
    return {
      title: name,
      description: circleDoc.data()?.description,
    };
  } catch {
    return { title: "Circle" };
  }
}

async function getWalletBalance(userId: string): Promise<number> {
  try {
    const walletDoc = await adminDb.collection("wallets").doc(userId).get();
    if (!walletDoc.exists) return 0;
    return (walletDoc.data()?.available as number) ?? 0;
  } catch {
    return 0;
  }
}

export default async function CircleDetailsPage({ params }: PageProps) {
  const { id } = await params;

  // Verify the circle exists server-side
  const circleDoc = await adminDb.collection("circles").doc(id).get();
  console.log(
    `[circle detail page] fetch circle id=${id} exists=${circleDoc.exists}`,
  );
  if (!circleDoc.exists) notFound();

  // Get wallet balance for the contribution dialog
  let walletBalance = 0;
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;
    if (!sessionCookie) {
      console.log("[circle detail page] no session cookie present");
    }
    if (sessionCookie) {
      try {
        const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
        console.log(
          `[circle detail page] verified session cookie for uid=${decoded.uid}`,
        );
        walletBalance = await getWalletBalance(decoded.uid);
      } catch (authErr) {
        console.error(
          "[circle detail page] session cookie verification failed",
          authErr,
        );
      }
    }
  } catch (err) {
    console.error("[circle detail page] wallet balance fetch failed", err);
    // Not logged in or expired session — middleware will catch unauthorized access
  }

  return (
    <CircleDetailContent circleId={id} walletBalance={walletBalance} />
  );
}