import type { Metadata } from "next";
import { AdminDisputesContent } from "@/components/admin/disputes/content";

export const metadata: Metadata = {
  title: "Disputes — AjoSave Admin",
  description:
    "Review, investigate, and resolve member disputes across all savings circles.",
};

export default function AdminDisputesPage() {
  return <AdminDisputesContent />;
}