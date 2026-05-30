import type { Metadata } from "next";
import { TransactionsContent } from "@/components/transaction/content";

export const metadata: Metadata = {
  title: "Transactions",
  description: "View your complete AjoSave payment history.",
};

export default function TransactionsPage() {
  return <TransactionsContent />;
}