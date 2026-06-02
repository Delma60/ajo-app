"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Event } from "@/lib/types/event";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventStatsStrip } from "./event-stats-strip";
import { ClaimsTable } from "./claims-table";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface EventDetailContentProps {
  eventId: string;
}

export function EventDetailContent({ eventId }: EventDetailContentProps) {
  const [claimsPage, setClaimsPage] = useState(1);

  const { data: eventData, isLoading: eventLoading } = useQuery({
    queryKey: ["adminEvent", eventId],
    queryFn: async () => {
      const response = await fetch(`/api/admin/events/${eventId}`);
      if (!response.ok) throw new Error("Failed to fetch event");
      return response.json();
    },
  });

  const { data: claimsData, isLoading: claimsLoading } = useQuery({
    queryKey: ["eventClaims", eventId, claimsPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(claimsPage),
        limit: "20",
      });
      const response = await fetch(
        `/api/admin/events/${eventId}/claims?${params}`,
      );
      if (!response.ok) throw new Error("Failed to fetch claims");
      return response.json();
    },
  });

  const event = eventData?.data as Event | undefined;
  const claims = claimsData?.data || [];
  const stats = claimsData?.stats;
  const pagination = claimsData?.pagination;

  if (eventLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-48 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");
      toast.success("Event status updated");
      // Refresh event data
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update status",
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/admin/events">
        <Button variant="outline" size="sm">
          <ArrowLeft className="size-4" />
          Back to Events
        </Button>
      </Link>

      {/* Event header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{event.title}</h1>
        <p className="text-muted-foreground">{event.description}</p>
      </div>

      {/* Event details card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Select value={event.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Trigger Type</p>
              <p className="font-medium capitalize text-sm mt-2">
                {event.triggerType.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reward Type</p>
              <p className="font-medium capitalize text-sm mt-2">
                {event.rewardType.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Total Claims</p>
              <p className="font-medium text-sm mt-2">
                {event.maxClaimsTotal === 0
                  ? "Unlimited"
                  : event.maxClaimsTotal}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Per User</p>
              <p className="font-medium text-sm mt-2">
                {event.maxClaimsPerUser}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && <EventStatsStrip stats={stats} />}

      {/* Claims table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claims</CardTitle>
          <CardDescription>All reward claims for this event</CardDescription>
        </CardHeader>
        <CardContent>
          <ClaimsTable
            claims={claims}
            currentPage={pagination?.page || 1}
            totalPages={pagination?.pages || 1}
            onPageChange={setClaimsPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
