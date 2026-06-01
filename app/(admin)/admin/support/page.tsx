import type { Metadata } from "next";
import { AdminSupportContent } from "@/components/admin/support/content";

export const metadata: Metadata = {
  title: "Support tickets — Admin — AjoSave",
};

export default function AdminSupportPage() {
  return <AdminSupportContent />;
}
