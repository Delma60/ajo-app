import type { Metadata } from "next";
import { AdminNotificationsContent } from "@/components/admin/notifications/content";

export const metadata: Metadata = {
  title: "Notifications — AjoSave Admin",
  description:
    "Monitor, manage, and broadcast platform-wide notifications across all users.",
};

export default function AdminNotificationsPage() {
  return <AdminNotificationsContent />;
}