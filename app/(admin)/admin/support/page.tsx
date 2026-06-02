import type { Metadata } from "next";
import { AdminSupportContent } from "@/components/admin/support/content";

export const metadata: Metadata = {
  title: "Support tickets — Admin — AjoSave",
};

export default function AdminSupportPage() {
  return (
    <div className="p-6 py-8 mt-6 max-w-4xl space-y-6">
      <AdminSupportContent />
    </div>
  );
}
