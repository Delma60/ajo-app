import type { Metadata } from "next";
import { AnalyticsContent } from "@/components/admin/analytics/content";

export const metadata: Metadata = {
  title: "Analytics — AjoSave Admin",
  description: "Platform-wide analytics: deposit volume, user growth, circle health, and transaction breakdown.",
};

export default function AdminAnalyticsPage() {
  return <AnalyticsContent />;
}