"use client";

import { useState } from "react";
import {
  UserIcon,
  ShieldIcon,
  BuildingIcon,
  BellIcon,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProfileTab } from "@/components/settings/profile-tab";
import { SecurityTab } from "@/components/settings/security-tab";
import { BankAccountsTab } from "@/components/settings/bank-accounts-tab";
import { NotificationsTab } from "@/components/settings/notifications-tab";

const TABS = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "security", label: "Security", icon: ShieldIcon },
  { id: "bank-accounts", label: "Bank Accounts", icon: BuildingIcon },
  { id: "notifications", label: "Notifications", icon: BellIcon },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface SettingsContentProps {
  defaultTab?: TabId;
}

export function SettingsContent({ defaultTab = "profile" }: SettingsContentProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-20 md:pb-6">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-5 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your account, security, and preferences.
          </p>
        </div>

        <Tabs defaultValue={defaultTab} orientation="horizontal">
          {/* Tab bar */}
          <TabsList className="w-full overflow-x-auto flex-none h-auto p-1 gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="flex-1 min-w-[100px] gap-1.5 text-xs sm:text-sm"
              >
                <Icon className="size-3.5 shrink-0" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <ProfileTab />
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <SecurityTab />
          </TabsContent>

          <TabsContent value="bank-accounts" className="mt-6">
            <BankAccountsTab />
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <NotificationsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}