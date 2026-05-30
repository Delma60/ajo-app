import type { Metadata } from "next";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { WithdrawContent } from "@/components/wallet/withdraw/content";

export const metadata: Metadata = {
  title: "Withdraw Funds",
  description: "Transfer your wallet balance to your bank account.",
};

async function getWalletBalance(userId: string): Promise<number> {
  try {
    const doc = await adminDb.collection("wallets").doc(userId).get();
    return (doc.data()?.available as number) ?? 0;
  } catch {
    return 0;
  }
}

export default async function WithdrawPage() {
  let walletBalance = 0;

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("__session")?.value;
    if (sessionCookie) {
      const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
      walletBalance = await getWalletBalance(decoded.uid);
    }
  } catch {
    // Middleware guards this route; swallow SSR errors
  }

  return <WithdrawContent walletBalance={walletBalance} />;
}