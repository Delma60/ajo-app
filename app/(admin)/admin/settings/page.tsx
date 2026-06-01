// app/(admin)/admin/settings/page.tsx
import type { Metadata } from "next";
import { AdminSettingsContent } from "@/components/admin/settings/content";

export const metadata: Metadata = {
  title: "Platform Settings — AjoSave Admin",
  description:
    "Configure platform-wide settings: fees, limits, penalties, trust score weights, and maintenance mode.",
};

export default function AdminSettingsPage() {
  return <AdminSettingsContent />;
}