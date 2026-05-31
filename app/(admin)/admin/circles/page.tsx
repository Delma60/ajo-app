import type { Metadata } from "next";
import { AdminCirclesContent } from "@/components/admin/circles/content";

export const metadata: Metadata = {
  title: "Circles — AjoSave Admin",
  description: "Monitor and manage all savings circles on the platform.",
};

export default function AdminCirclesPage() {
  return <AdminCirclesContent />;
} 