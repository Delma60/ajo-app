import type { Metadata } from "next";
import { AdminDashboardContent } from "@/components/admin/content";

export const metadata: Metadata = {
  title: "Admin Dashboard — AjoSave",
};

export default function AdminDashboardPage() {
  return <AdminDashboardContent />;
}
