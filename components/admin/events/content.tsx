"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Event } from "@/lib/types/event";
import { formatDistanceToNow } from "date-fns";
import { parseTimestamp } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { EventStatsStrip } from "./event-stats-strip";
import { Plus, ExternalLink } from "lucide-react";
import Link from "next/link";

export function AdminEventsContent() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["adminEvents", page, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        ...(status !== "all" && { status }),
      });

      const response = await fetch(`/api/admin/events?${params}`);
      if (!response.ok) throw new Error("Failed to fetch events");
      return response.json();
    },
  });

  const events = (data?.data as Event[]) || [];
  const pagination = data?.pagination;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-muted rounded-lg animate-pulse" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <EventStatsStrip
        stats={{
          totalClaims: 0,
          awardedClaims: 0,
          totalRewardKobo: 0,
          uniqueParticipants: 0,
        }}
      />

      {/* Filters and controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 w-full sm:w-auto">
          <Input placeholder="Search events..." className="flex-1 sm:w-64" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Link href="/admin/events/create">
          <Button>
            <Plus className="size-4" />
            New Event
          </Button>
        </Link>
      </div>

      {/* Mobile list (small screens) */}
      <div className="space-y-3 sm:hidden">
        {events.map((event) => (
          <Card key={event.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm">{event.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {event.triggerType.replace(/_/g, " ")}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="capitalize mb-2">
                    {event.status}
                  </Badge>
                  <div className="text-xs text-muted-foreground">
                    {(() => {
                      const createdAt = parseTimestamp(event.createdAt);
                      return createdAt
                        ? formatDistanceToNow(createdAt, { addSuffix: true })
                        : "Unknown";
                    })()}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {event.rewardType.replace(/_/g, " ")}
                </div>
                <Link href={`/admin/events/${event.id}`}>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="size-4" />
                    View
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Events table (desktop) */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium text-sm">
                  {event.title}
                </TableCell>
                <TableCell className="text-xs capitalize">
                  {event.triggerType.replace(/_/g, " ")}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {event.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {event.rewardType.replace(/_/g, " ")}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {(() => {
                    const createdAt = parseTimestamp(event.createdAt);
                    return createdAt
                      ? formatDistanceToNow(createdAt, { addSuffix: true })
                      : "Unknown";
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/events/${event.id}`}>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="size-4" />
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.pages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === pagination.pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
