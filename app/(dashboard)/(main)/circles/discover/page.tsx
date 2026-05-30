import type { Metadata } from "next";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { DiscoverCirclesContent } from "@/components/circles/dsicover-circle-content";

export const metadata: Metadata = {
  title: "Discover Circles",
  description: "Find public savings circles to join and start saving together.",
};

async function getMyCircleIds(userId: string): Promise<string[]> {
  try {
    const doc = await adminDb.collection("users").doc(userId).get();
    return (doc.data()?.circleIds as string[]) ?? [];
  } catch {
    return [];
  }
}

export default async function DiscoverCirclesPage() {
  let myCircleIds: string[] = [];

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;
    if (sessionCookie) {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
      myCircleIds = await getMyCircleIds(decoded.uid);
    }
  } catch {
    // Middleware ensures authenticated access; swallow SSR errors gracefully
  }

  return <DiscoverCirclesContent myCircleIds={myCircleIds} />;
}