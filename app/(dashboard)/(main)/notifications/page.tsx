import { NotificationsContent } from "@/components/notification/content";
import type { Metadata } from "next";
// import { NotificationsContent } from "@/components/notifications/content";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Stay up to date with your circles and wallet activity.",
};

export default function NotificationsPage() {
  return <NotificationsContent />;
}