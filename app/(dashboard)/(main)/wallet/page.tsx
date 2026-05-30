import type { Metadata } from "next";
import { WalletContent } from "@/components/wallet/content";

export const metadata: Metadata = {
  title: "My Wallet",
  description: "Manage your AjoSave wallet balance, deposits, and withdrawals.",
};

export default function WalletPage() {
  return <WalletContent />;
}