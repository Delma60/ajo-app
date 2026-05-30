import type { Metadata } from "next";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { DepositContent } from "@/components/wallet/deposit/content";

export const metadata: Metadata = {
  title: "Fund Wallet",
  description: "Add money to your AjoSave wallet securely via Flutterwave.",
};

async function getWalletBalance(userId: string): Promise<number> {
  try {
    const doc = await adminDb.collection("wallets").doc(userId).get();
    return (doc.data()?.available as number) ?? 0;
  } catch {
    return 0;
  }
}

async function getUserProfile(userId: string) {
  try {
    const doc = await adminDb.collection("users").doc(userId).get();
    const data = doc.data();
    return {
      name: (data?.name as string) ?? "",
      email: (data?.email as string) ?? "",
    };
  } catch {
    return { name: "", email: "" };
  }
}

export default async function DepositPage() {
  let walletBalance = 0;
  let userProfile = { name: "", email: "" };

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;
    if (sessionCookie) {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
      [walletBalance, userProfile] = await Promise.all([
        getWalletBalance(decoded.uid),
        getUserProfile(decoded.uid),
      ]);
    }
  } catch {
    // Middleware guards this route; swallow SSR errors gracefully
  }

  return (
    <DepositContent
      walletBalance={walletBalance}
      userName={userProfile.name}
    />
  );
}