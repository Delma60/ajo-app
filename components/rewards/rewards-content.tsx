"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActiveEventsList } from "./active-events-list";
import { BadgeCollection } from "./badge-collection";
import { RewardHistory } from "./reward-history";
import { Award, Zap, History } from "lucide-react";

export function RewardsContent() {
  const [activeTab, setActiveTab] = useState("events");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rewards & Events</h1>
        <p className="text-muted-foreground mt-1">
          Earn badges and rewards by completing savings milestones
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="events" className="gap-2">
            <Zap className="size-4" />
            <span className="hidden sm:inline">Events</span>
          </TabsTrigger>
          <TabsTrigger value="badges" className="gap-2">
            <Award className="size-4" />
            <span className="hidden sm:inline">Badges</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" />
            <span className="hidden sm:inline">History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4 mt-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Active Events</h2>
            <ActiveEventsList />
          </div>
        </TabsContent>

        <TabsContent value="badges" className="space-y-4 mt-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Your Badges</h2>
            <BadgeCollection />
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Reward History</h2>
            <RewardHistory />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
