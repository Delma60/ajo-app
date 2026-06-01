import type { Metadata } from "next";
import { AdminInvestmentsContent } from "@/components/admin/investments/content";

export const metadata: Metadata = {
  title: "Investments — AjoSave Admin",
  description:
    "Monitor and manage all investment positions across the platform. Force payouts, cancel investments, and view portfolio analytics.",
};

export default function AdminInvestmentsPage() {
  return <AdminInvestmentsContent />;
}