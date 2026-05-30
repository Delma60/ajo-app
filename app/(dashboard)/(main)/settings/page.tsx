import type { Metadata } from "next";
import { SettingsContent } from "@/components/settings/content";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your AjoSave account, security, and preferences.",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const validTabs = ["profile", "security", "bank-accounts", "notifications"] as const;
  type TabId = (typeof validTabs)[number];

  const tab = validTabs.includes(params.tab as TabId)
    ? (params.tab as TabId)
    : "profile";

  return <SettingsContent defaultTab={tab} />;
}