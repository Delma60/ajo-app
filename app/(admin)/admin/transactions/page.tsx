import type { Metadata } from "next";
import { AdminTransactionsContent } from "@/components/admin/transactions/content";

export const metadata: Metadata = {
  title: "Transactions — AjoSave Admin",
  description:
    "Monitor and investigate all financial transactions across the platform.",
};

export default function AdminTransactionsPage() {
  return <AdminTransactionsContent />;
}